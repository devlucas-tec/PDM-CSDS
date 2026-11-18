import type { SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '@/lib/format';
import { getSyncTable, serializeKey, whereKey, type RowKey, type SyncTableName } from '@/sync/tables';

/**
 * Fila de requisições ao backend (padrão "transactional outbox").
 *
 * Os repositórios gravam primeiro no SQLite e, na mesma transação, chamam
 * `enqueue`. Assim a alteração e o pedido de envio nunca se separam: se o app
 * fechar no meio, ou os dois existem, ou nenhum. O sincronizador envia a fila
 * em ordem e só remove cada item depois que o servidor confirma.
 */

export type Operacao = 'inserir' | 'salvar' | 'excluir';

export type QueueItem = {
  id: number;
  tabela: SyncTableName;
  operacao: Operacao;
  chave: string;
  dados: string | null;
  criado_em: string;
  tentativas: number;
  status: 'pendente' | 'erro';
  ultimo_erro: string | null;
};

/** Listeners avisados sempre que algo entra na fila (o sincronizador escuta para agir logo). */
const listeners = new Set<() => void>();

export function onEnqueue(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Coloca na fila o estado atual do registro (já gravado no SQLite).
 * - inserir: registro novo de tabela imutável (histórico, auditoria, relatório);
 * - salvar: cria ou atualiza (upsert) com todas as colunas;
 * - excluir: apaga no servidor.
 */
export async function enqueue(db: SQLiteDatabase, tabela: SyncTableName, operacao: Operacao, key: RowKey) {
  const table = getSyncTable(tabela);
  if (table.pullOnly) throw new Error(`A tabela ${tabela} não é enviada pelo aplicativo.`);

  let dados: string | null = null;
  if (operacao !== 'excluir') {
    const where = whereKey(table, key);
    const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${tabela} WHERE ${where.sql}`, where.params);
    if (!row) throw new Error(`Registro não encontrado para enviar: ${tabela}`);
    dados = JSON.stringify(row);
  }

  await db.runAsync(
    'INSERT INTO fila_sincronizacao (tabela, operacao, chave, dados, criado_em) VALUES (?, ?, ?, ?, ?)',
    tabela,
    operacao,
    serializeKey(table, key),
    dados,
    nowIso(),
  );
  notify();
}

/** Igual a `enqueue`, mas com a linha já em mãos (evita reler o banco em gravações em lote). */
export async function enqueueRow(db: SQLiteDatabase, tabela: SyncTableName, row: Record<string, unknown>) {
  const table = getSyncTable(tabela);
  await db.runAsync(
    'INSERT INTO fila_sincronizacao (tabela, operacao, chave, dados, criado_em) VALUES (?, ?, ?, ?, ?)',
    tabela,
    table.insertOnly ? 'inserir' : 'salvar',
    serializeKey(table, Object.fromEntries(table.pk.map((c) => [c, String(row[c])]))),
    JSON.stringify(row),
    nowIso(),
  );
  notify();
}

export function enqueueId(db: SQLiteDatabase, tabela: SyncTableName, operacao: Operacao, id: string) {
  return enqueue(db, tabela, operacao, { id });
}

export async function countPending(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ pendentes: number; erros: number }>(
    `SELECT COALESCE(SUM(status = 'pendente'), 0) AS pendentes, COALESCE(SUM(status = 'erro'), 0) AS erros
     FROM fila_sincronizacao`,
  );
  return { pendentes: row?.pendentes ?? 0, erros: row?.erros ?? 0 };
}

export function listQueue(db: SQLiteDatabase, limit = 50) {
  return db.getAllAsync<QueueItem>('SELECT * FROM fila_sincronizacao ORDER BY id LIMIT ?', limit);
}

/** Itens com erro voltam para a fila (por exemplo, depois que a coordenação corrigiu algo). */
export async function retryFailed(db: SQLiteDatabase) {
  await db.runAsync("UPDATE fila_sincronizacao SET status = 'pendente', tentativas = 0 WHERE status = 'erro'");
  notify();
}

/** Descarta os itens com erro (o servidor recusou). Depois disso convém baixar tudo de novo. */
export async function discardFailed(db: SQLiteDatabase) {
  await db.runAsync("DELETE FROM fila_sincronizacao WHERE status = 'erro'");
}
