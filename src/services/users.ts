import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DomainError } from '@/database/errors';
import type { Perfil, Usuario } from '@/database/types';
import { saveLocalUser } from '@/database/user-repository';
import { supabase } from '@/lib/supabase';

export type NewUserInput = { nome: string; email: string; senha: string; perfil: Perfil; telefone?: string | null };

export const OFFLINE_MESSAGE = 'Sem conexão com a internet. Esta ação precisa de internet; tente novamente quando a conexão voltar.';

/**
 * Cria uma conta da equipe pela Edge Function `gerenciar-usuarios`. É a única
 * ação do app que exige internet, porque a conta precisa existir no servidor
 * para a pessoa conseguir entrar. A cópia local é gravada logo em seguida.
 */
export async function createStaffAccount(db: SQLiteDatabase, input: NewUserInput) {
  const { data, error } = await supabase.functions.invoke<{ usuario: Usuario & { updated_at: string } }>('gerenciar-usuarios', {
    body: input,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new DomainError(body?.erro ?? 'O servidor recusou o cadastro.', body?.campo);
    }
    if (error instanceof FunctionsFetchError) throw new DomainError(OFFLINE_MESSAGE);
    throw new DomainError('Não foi possível cadastrar o usuário. Tente novamente.');
  }
  if (!data?.usuario) throw new DomainError('Resposta inesperada do servidor.');
  await saveLocalUser(db, {
    ...data.usuario,
    created_at: new Date(data.usuario.created_at).toISOString(),
    updated_at: new Date(data.usuario.updated_at).toISOString(),
  });
  return data.usuario.id;
}
