import type { RowKey, SyncTableName } from '@/sync/tables';

/**
 * Erro vindo do backend. `transient` indica se vale tentar de novo mais tarde
 * (sem internet, servidor fora do ar, sessão expirada) ou se o servidor
 * recusou a operação de vez (regra de acesso, CPF repetido, etc.).
 */
export class RemoteError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

export type Tombstone = { id: number; tabela: string; chave: RowKey };

/**
 * O que o sincronizador precisa do backend. A implementação real usa o
 * supabase-js (src/sync/supabase-remote.ts); os testes usam uma versão em memória.
 */
export interface SyncRemote {
  /** Cria ou atualiza linhas. Com ignoreDuplicates, linhas já existentes são mantidas. */
  upsert(table: SyncTableName, rows: Record<string, unknown>[], options: { onConflict: string; ignoreDuplicates: boolean }): Promise<void>;
  remove(table: SyncTableName, keys: RowKey[]): Promise<void>;
  /** Linhas alteradas no servidor depois de `since` (updated_at), em ordem crescente. */
  pullChanges(table: SyncTableName, since: string | null, limit: number): Promise<Record<string, unknown>[]>;
  /** Exclusões registradas depois do id `after`, em ordem crescente. */
  pullDeletions(after: number, limit: number): Promise<Tombstone[]>;
}
