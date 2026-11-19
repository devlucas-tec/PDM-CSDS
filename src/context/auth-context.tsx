import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { logAudit } from '@/database/audit-repository';
import { DomainError } from '@/database/errors';
import { deletePreference, getPreference, setPreference } from '@/database/preferences-repository';
import type { Usuario } from '@/database/types';
import { getUser, saveLocalUser } from '@/database/user-repository';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { createStaffAccount, OFFLINE_MESSAGE } from '@/services/users';
import { resetLocalData, syncNow } from '@/sync/engine';
import { supabaseRemote } from '@/sync/supabase-remote';

/** Último usuário que entrou neste aparelho (para abrir o app offline e para trocar de conta). */
const LAST_USER_KEY = 'auth:usuario';

type AuthContextValue = {
  user: Usuario | null;
  /** false enquanto a sessão salva ainda está sendo lida. */
  ready: boolean;
  /** Se ainda não existe nenhum usuário no servidor, o app pede o cadastro do primeiro administrador. */
  hasUsers: boolean;
  signIn: (email: string, senha: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  registerFirstAdmin: (input: { nome: string; email: string; senha: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Busca o perfil no servidor e guarda a cópia local. */
async function fetchProfile(db: Parameters<typeof saveLocalUser>[0], id: string) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const user = { ...data, created_at: new Date(data.created_at).toISOString(), updated_at: new Date(data.updated_at).toISOString() };
  await saveLocalUser(db, user);
  return user as Usuario;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<Usuario | null>(null);
  const [hasUsers, setHasUsers] = useState(true);
  const [ready, setReady] = useState(false);

  // Abertura do app: a sessão do Supabase fica salva no aparelho. Sem internet
  // e com o token vencido, o Supabase não consegue renová-lo; nesse caso o app
  // continua com o último usuário (offline first) e renova quando a conexão voltar.
  useEffect(() => {
    let active = true;
    (async () => {
      const lastUserId = await getPreference(db, LAST_USER_KEY);
      let userId: string | null = null;
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.getSession();
        userId = data.session?.user.id ?? (error && isAuthRetryableFetchError(error) ? lastUserId : null);
        if (!userId && lastUserId) {
          // Sem sessão e sem internet: segue com o último usuário; a sessão é
          // retomada quando a conexão voltar (a sincronização avisa se for preciso entrar de novo).
          const network = await Network.getNetworkStateAsync().catch(() => null);
          if (network && (network.isConnected === false || network.isInternetReachable === false)) userId = lastUserId;
        }
      }
      const found = userId ? ((await getUser(db, userId)) ?? (await fetchProfile(db, userId))) : null;

      let usersExist = true;
      if (!found && isSupabaseConfigured) {
        const { data, error } = await supabase.rpc('possui_usuarios');
        // Sem internet não dá para saber; mostra o login (que avisa da falta de conexão).
        usersExist = error ? true : Boolean(data);
      }
      if (!active) return;
      setUser(found);
      setHasUsers(usersExist);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [db]);

  // Se o servidor encerrar a sessão (ex.: conta removida), volta para o login.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(
    async (email: string, senha: string) => {
      if (!isSupabaseConfigured) throw new DomainError('Backend não configurado: crie o arquivo .env.local (veja .env.example).');
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
      if (error) {
        if (isAuthRetryableFetchError(error)) throw new DomainError(OFFLINE_MESSAGE);
        return false;
      }
      const id = data.user.id;

      // Outra pessoa usou este aparelho antes: os dados locais eram dela.
      const lastUserId = await getPreference(db, LAST_USER_KEY);
      if (lastUserId && lastUserId !== id) await resetLocalData(db);

      const profile = await fetchProfile(db, id);
      if (!profile) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new DomainError('Esta conta não tem perfil na equipe. Fale com o administrador.');
      }
      await setPreference(db, LAST_USER_KEY, id);
      await db.withTransactionAsync(() => logAudit(db, { usuarioId: id, acao: 'login', entidade: 'sessao' }));
      setHasUsers(true);
      setUser(profile);
      return true;
    },
    [db],
  );

  /**
   * Antes de sair, tenta enviar a fila. O que não for enviado é perdido, por
   * isso a tela de conta pede confirmação quando há pendências.
   */
  const signOut = useCallback(async () => {
    if (user) {
      await db.withTransactionAsync(() => logAudit(db, { usuarioId: user.id, acao: 'logout', entidade: 'sessao' }));
      await syncNow(db, supabaseRemote).catch(() => undefined);
    }
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await resetLocalData(db);
    await deletePreference(db, LAST_USER_KEY);
    setUser(null);
  }, [db, user]);

  const registerFirstAdmin = useCallback(
    async (input: { nome: string; email: string; senha: string }) => {
      // A Edge Function só aceita sem login enquanto não existir nenhum usuário.
      await createStaffAccount(db, { ...input, perfil: 'admin' });
      // O signIn já marca que existem usuários junto com o usuário logado. Marcar
      // antes fazia a tela de login piscar entre o cadastro e a entrada no app.
      try {
        await signIn(input.email, input.senha);
      } finally {
        // Se o login falhar (ex.: sem internet), a conta já existe: mostra o login.
        setHasUsers(true);
      }
    },
    [db, signIn],
  );

  const value = useMemo(
    () => ({ user, ready, hasUsers, signIn, signOut, registerFirstAdmin }),
    [user, ready, hasUsers, signIn, signOut, registerFirstAdmin],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return context;
}

/** Usuário logado. Use apenas em telas protegidas (que só abrem com sessão ativa). */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) throw new Error('Nenhum usuário autenticado.');
  return user;
}
