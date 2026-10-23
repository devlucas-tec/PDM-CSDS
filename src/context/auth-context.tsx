import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import type { Usuario } from '@/database/types';
import { authenticate, countUsers, createUser, endSession, getSessionUser, startSession } from '@/database/user-repository';

type AuthContextValue = {
  user: Usuario | null;
  /** false enquanto a sessão salva ainda está sendo lida do banco. */
  ready: boolean;
  /** Se ainda não existe nenhum usuário, o app pede o cadastro do primeiro administrador. */
  hasUsers: boolean;
  signIn: (email: string, senha: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  registerFirstAdmin: (input: { nome: string; email: string; senha: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<Usuario | null>(null);
  const [hasUsers, setHasUsers] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [total, sessionUser] = await Promise.all([countUsers(db), getSessionUser(db)]);
      if (!active) return;
      setHasUsers(total > 0);
      setUser(sessionUser);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [db]);

  const signIn = useCallback(
    async (email: string, senha: string) => {
      const found = await authenticate(db, email, senha);
      if (!found) return false;
      await startSession(db, found.id);
      setUser(found);
      return true;
    },
    [db],
  );

  const signOut = useCallback(async () => {
    await endSession(db, user?.id ?? null);
    setUser(null);
  }, [db, user]);

  const registerFirstAdmin = useCallback(
    async (input: { nome: string; email: string; senha: string }) => {
      // Só é permitido enquanto não houver nenhum usuário cadastrado.
      if ((await countUsers(db)) > 0) throw new Error('Já existe um administrador cadastrado.');
      await createUser(db, { ...input, perfil: 'admin' }, null);
      setHasUsers(true);
      await signIn(input.email, input.senha);
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
