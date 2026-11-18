import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { getPreference } from '@/database/preferences-repository';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { LAST_SYNC_KEY, resetLocalData, syncNow } from '@/sync/engine';
import { countPending, discardFailed, onEnqueue, retryFailed } from '@/sync/outbox';
import { RemoteError } from '@/sync/remote';
import { supabaseRemote } from '@/sync/supabase-remote';

/** Espera depois de uma alteração local antes de enviar (junta alterações em sequência). */
const DEBOUNCE_MS = 800;
/** Com internet, busca novidades de outros aparelhos periodicamente. */
const POLL_MS = 30_000;
/** Espera entre tentativas após falha: 2s, 4s, 8s... até 2 minutos. */
const MAX_BACKOFF_MS = 120_000;

type SyncContextValue = {
  online: boolean;
  syncing: boolean;
  pendentes: number;
  erros: number;
  ultimaSync: string | null;
  ultimoErro: string | null;
  /** Muda sempre que dados novos chegam do servidor (as telas recarregam). */
  dataVersion: number;
  syncNow: () => Promise<void>;
  retryErrors: () => Promise<void>;
  /** Descarta os itens recusados e baixa tudo de novo do servidor. */
  discardErrorsAndReload: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

function isOnline(state: NetworkState | null) {
  if (!state) return true;
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function SyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState({ pendentes: 0, erros: 0 });
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [ultimoErro, setUltimoErro] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const onlineRef = useRef(true);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => undefined);

  const refreshCounts = useCallback(async () => {
    setCounts(await countPending(db));
    setUltimaSync(await getPreference(db, LAST_SYNC_KEY));
  }, [db]);

  const schedule = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      runRef.current();
    }, delay);
  }, []);

  const run = useCallback(async () => {
    if (!user || !isSupabaseConfigured || !onlineRef.current) {
      await refreshCounts();
      return;
    }
    setSyncing(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new RemoteError('Sessão expirada: saia e entre novamente para enviar as alterações.', true);
      const result = await syncNow(db, supabaseRemote);
      failures.current = 0;
      setUltimoErro(result.recusados > 0 ? `${result.recusados} alteração(ões) recusada(s) pelo servidor.` : null);
      if (result.recebidos > 0 || result.excluidos > 0) setDataVersion((v) => v + 1);
      schedule(POLL_MS);
    } catch (error) {
      failures.current += 1;
      setUltimoErro(error instanceof Error ? error.message : 'Falha na sincronização.');
      // Nova tentativa com espera crescente (backoff exponencial).
      schedule(Math.min(2000 * 2 ** (failures.current - 1), MAX_BACKOFF_MS));
    } finally {
      setSyncing(false);
      await refreshCounts();
    }
  }, [db, user, refreshCounts, schedule]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // Conectividade: ao voltar a internet, envia a fila na hora.
  useEffect(() => {
    getNetworkStateAsync()
      .then((state) => {
        onlineRef.current = isOnline(state);
        setOnline(onlineRef.current);
      })
      .catch(() => undefined);
    const subscription = addNetworkStateListener((state) => {
      const next = isOnline(state);
      const cameBack = next && !onlineRef.current;
      onlineRef.current = next;
      setOnline(next);
      if (cameBack) {
        failures.current = 0;
        schedule(500);
      }
    });
    return () => subscription.remove();
  }, [schedule]);

  // Ao entrar (ou trocar de usuário): sincroniza logo. Ao sair: para tudo.
  useEffect(() => {
    schedule(0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user, schedule]);

  // Cada alteração local entra na fila; agenda o envio.
  useEffect(
    () =>
      onEnqueue(() => {
        setCounts((c) => ({ ...c, pendentes: c.pendentes + 1 }));
        if (failures.current === 0) schedule(DEBOUNCE_MS);
      }),
    [schedule],
  );

  // App voltou para a frente: sincroniza.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule(300);
    });
    return () => subscription.remove();
  }, [schedule]);

  const manualSync = useCallback(async () => {
    failures.current = 0;
    await run();
  }, [run]);

  const retryErrors = useCallback(async () => {
    await retryFailed(db);
    failures.current = 0;
    await run();
  }, [db, run]);

  const discardErrorsAndReload = useCallback(async () => {
    await discardFailed(db);
    // Mantém o que ainda está pendente (válido) e baixa tudo de novo.
    await resetLocalData(db, { keepQueue: true });
    setDataVersion((v) => v + 1);
    await run();
  }, [db, run]);

  const value = useMemo(
    () => ({
      online,
      syncing,
      pendentes: counts.pendentes,
      erros: counts.erros,
      ultimaSync,
      ultimoErro,
      dataVersion,
      syncNow: manualSync,
      retryErrors,
      discardErrorsAndReload,
    }),
    [online, syncing, counts, ultimaSync, ultimoErro, dataVersion, manualSync, retryErrors, discardErrorsAndReload],
  );

  return <SyncContext value={value}>{children}</SyncContext>;
}

export function useSync() {
  const context = use(SyncContext);
  if (!context) throw new Error('useSync deve ser usado dentro de <SyncProvider>.');
  return context;
}

/** Número que muda quando chegam dados do servidor; use nas dependências do carregamento da tela. */
export function useDataVersion() {
  return useSync().dataVersion;
}
