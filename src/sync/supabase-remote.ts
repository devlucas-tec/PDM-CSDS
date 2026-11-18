import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { RemoteError, type SyncRemote, type Tombstone } from '@/sync/remote';
import type { RowKey } from '@/sync/tables';

/**
 * Sem internet o supabase-js devolve status 0. 401 é sessão expirada (o token
 * é renovado e o envio tenta de novo); 408, 429 e 5xx também são temporários.
 * O resto (403 de regra de acesso, 409 de chave repetida, 400 de validação)
 * é uma recusa definitiva do servidor.
 */
function check(response: { error: PostgrestError | null; status: number }) {
  if (!response.error) return;
  const { status, error } = response;
  const transient = !status || status === 401 || status === 408 || status === 429 || status >= 500;
  throw new RemoteError(friendlyMessage(error), transient);
}

function friendlyMessage(error: PostgrestError) {
  if (error.code === '42501') return 'Sem permissão para esta alteração (regra de acesso do servidor).';
  if (error.code === '23505') return `Registro duplicado no servidor: ${error.details ?? error.message}`;
  if (error.code === '23503') return 'Registro relacionado não existe mais no servidor (pode ter sido excluído em outro aparelho).';
  return error.message;
}

export const supabaseRemote: SyncRemote = {
  async upsert(table, rows, { onConflict, ignoreDuplicates }) {
    check(await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates }));
  },

  async remove(table, keys) {
    if (keys.length === 0) return;
    const columns = Object.keys(keys[0]);
    if (columns.length === 1) {
      const [column] = columns;
      check(await supabase.from(table).delete().in(column, keys.map((key) => key[column])));
      return;
    }
    for (const key of keys) check(await supabase.from(table).delete().match(key));
  },

  async pullChanges(table, since, limit) {
    let query = supabase.from(table).select('*').order('updated_at', { ascending: true }).limit(limit);
    if (since) query = query.gt('updated_at', since);
    const response = await query;
    check(response);
    return (response.data ?? []) as Record<string, unknown>[];
  },

  async pullDeletions(after, limit) {
    const response = await supabase
      .from('exclusoes')
      .select('id, tabela, chave')
      .gt('id', after)
      .order('id', { ascending: true })
      .limit(limit);
    check(response);
    return (response.data ?? []).map((row) => ({ id: Number(row.id), tabela: row.tabela, chave: row.chave as RowKey }) satisfies Tombstone);
  },
};
