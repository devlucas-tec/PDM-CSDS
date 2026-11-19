import type { SQLiteDatabase } from 'expo-sqlite';

import { getPreference, setPreference } from '@/database/preferences-repository';
import { DATA_TABLES } from '@/database/schema';
import type { QueueItem } from '@/sync/outbox';
import { RemoteError, type SyncRemote } from '@/sync/remote';
import { getSyncTable, keyFromRow, serializeKey, SYNC_TABLES, whereKey, type RowKey, type SyncTable } from '@/sync/tables';

/**
 * Sincronização offline first.
 *
 * 1. ENVIO (push): a fila `fila_sincronizacao` é enviada em ordem de criação.
 *    Itens seguidos da mesma tabela e operação vão juntos num só pedido (lote).
 *    - Falha temporária (sem internet, servidor fora, sessão expirada): para
 *      tudo e tenta de novo depois, sem perder a ordem.
 *    - Recusa do servidor (regra de acesso, CPF repetido...): o item fica com
 *      status "erro" e aparece na tela de sincronização; os demais seguem.
 *    Todo envio é idempotente (upsert pela chave gerada no aparelho), então
 *    reenviar algo que o servidor já recebeu não duplica nada.
 *
 * 2. RECEBIMENTO (pull): para cada tabela, baixa as linhas com updated_at
 *    maior que o último recebido e grava no SQLite. Linhas com alteração
 *    local ainda na fila não são sobrescritas (a versão local vence até ser
 *    enviada). Depois aplica as exclusões feitas em outros aparelhos.
 */

const PUSH_BATCH = 200;
const PULL_PAGE = 1000;
/** Margem para não perder linhas gravadas por transações concorrentes no servidor. */
const PULL_OVERLAP_MS = 5000;

const CURSOR_PREFIX = 'sync:cursor:';
const DELETIONS_CURSOR = `${CURSOR_PREFIX}exclusoes`;
export const LAST_SYNC_KEY = 'sync:ultima';

export type PushResult = { enviados: number; recusados: number };
export type PullResult = { recebidos: number; excluidos: number };
export type SyncResult = PushResult & PullResult;

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

function parseKey(item: QueueItem): RowKey {
  return JSON.parse(item.chave) as RowKey;
}

async function sendGroup(remote: SyncRemote, table: SyncTable, items: QueueItem[]) {
  if (items[0].operacao === 'excluir') {
    await remote.remove(table.name, items.map(parseKey));
    return;
  }
  // Se o mesmo registro aparece mais de uma vez no lote, vale a versão mais recente.
  const latest = new Map<string, Record<string, unknown>>();
  for (const item of items) latest.set(item.chave, JSON.parse(item.dados ?? '{}'));
  await remote.upsert(table.name, [...latest.values()], {
    onConflict: table.pk.join(','),
    ignoreDuplicates: items[0].operacao === 'inserir',
  });
}

async function markFailed(db: SQLiteDatabase, item: QueueItem, error: RemoteError) {
  await db.runAsync(
    "UPDATE fila_sincronizacao SET status = 'erro', tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?",
    error.message,
    item.id,
  );
}

async function removeItems(db: SQLiteDatabase, items: QueueItem[]) {
  await db.runAsync(`DELETE FROM fila_sincronizacao WHERE id IN (${items.map(() => '?').join(', ')})`, items.map((i) => i.id));
}

function toRemoteError(error: unknown) {
  if (error instanceof RemoteError) return error;
  return new RemoteError(error instanceof Error ? error.message : String(error), true);
}

/** Envia a fila em ordem. Lança RemoteError (temporário) se precisar parar. */
export async function pushQueue(db: SQLiteDatabase, remote: SyncRemote): Promise<PushResult> {
  const result: PushResult = { enviados: 0, recusados: 0 };
  for (;;) {
    const items = await db.getAllAsync<QueueItem>(
      "SELECT * FROM fila_sincronizacao WHERE status = 'pendente' ORDER BY id LIMIT ?",
      PUSH_BATCH,
    );
    if (items.length === 0) return result;

    // Primeiro grupo de itens consecutivos com a mesma tabela e operação.
    const group = [items[0]];
    for (const item of items.slice(1)) {
      if (item.tabela !== group[0].tabela || item.operacao !== group[0].operacao) break;
      group.push(item);
    }
    const table = getSyncTable(group[0].tabela);

    try {
      await sendGroup(remote, table, group);
      await removeItems(db, group);
      result.enviados += group.length;
      continue;
    } catch (raw) {
      const error = toRemoteError(raw);
      if (error.transient) {
        await db.runAsync('UPDATE fila_sincronizacao SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?', error.message, group[0].id);
        throw error;
      }
      if (group.length === 1) {
        await markFailed(db, group[0], error);
        result.recusados++;
        continue;
      }
    }

    // O lote foi recusado: envia um a um para isolar o(s) item(ns) com problema.
    for (const item of group) {
      try {
        await sendGroup(remote, table, [item]);
        await removeItems(db, [item]);
        result.enviados++;
      } catch (raw) {
        const error = toRemoteError(raw);
        if (error.transient) throw error;
        await markFailed(db, item, error);
        result.recusados++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Recebimento
// ---------------------------------------------------------------------------

const columnCache = new Map<string, Set<string>>();

async function localColumns(db: SQLiteDatabase, table: string) {
  let columns = columnCache.get(table);
  if (!columns) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    columns = new Set(info.map((c) => c.name));
    columnCache.set(table, columns);
  }
  return columns;
}

/** Datas do Postgres ("2026-11-18 12:00:00.123+00") viram ISO, como o app grava localmente. */
function normalizeValue(column: string, value: unknown) {
  if (value === undefined || value === null) return null;
  if (column.endsWith('_at') && typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value as string | number;
}

async function pendingKeys(db: SQLiteDatabase, table: string) {
  const rows = await db.getAllAsync<{ chave: string }>('SELECT DISTINCT chave FROM fila_sincronizacao WHERE tabela = ?', table);
  return new Set(rows.map((r) => r.chave));
}

async function applyRows(db: SQLiteDatabase, table: SyncTable, rows: Record<string, unknown>[]) {
  const available = await localColumns(db, table.name);
  const skip = await pendingKeys(db, table.name);
  let applied = 0;
  for (const row of rows) {
    if (skip.has(serializeKey(table, keyFromRow(table, row)))) continue;
    const columns = Object.keys(row).filter((c) => available.has(c));
    const values = columns.map((c) => normalizeValue(c, row[c]));
    const updates = columns.filter((c) => !table.pk.includes(c)).map((c) => `${c} = excluded.${c}`);
    const conflict =
      table.insertOnly || updates.length === 0 ? 'DO NOTHING' : `DO UPDATE SET ${updates.join(', ')}`;
    try {
      await db.runAsync(
        `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
         ON CONFLICT (${table.pk.join(', ')}) ${conflict}`,
        values,
      );
    } catch (error) {
      // A linha do servidor bate com uma alteração local ainda não aceita (ex.: o
      // mesmo CPF cadastrado offline neste aparelho e recusado pelo servidor). Ela
      // é ignorada por enquanto; quando o usuário descarta o item com erro, o app
      // baixa tudo de novo e a versão do servidor entra.
      if (skip.size > 0) continue;
      throw error;
    }
    applied++;
  }
  return applied;
}

/**
 * As linhas chegam em ordem de tabela (pais antes dos filhos), mas regras de
 * acesso podem esconder um "pai" (ex.: professor não vê todos os alunos).
 * Por isso as chaves estrangeiras ficam desligadas só durante a aplicação.
 */
async function withoutForeignKeys(db: SQLiteDatabase, task: () => Promise<void>) {
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.withTransactionAsync(task);
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
}

function startCursor(cursor: string | null) {
  if (!cursor) return null;
  const time = new Date(cursor).getTime();
  return Number.isNaN(time) ? cursor : new Date(time - PULL_OVERLAP_MS).toISOString();
}

export async function pullChanges(db: SQLiteDatabase, remote: SyncRemote): Promise<PullResult> {
  const result: PullResult = { recebidos: 0, excluidos: 0 };

  for (const table of SYNC_TABLES) {
    const cursorKey = `${CURSOR_PREFIX}${table.name}`;
    const saved = await getPreference(db, cursorKey);
    let since = startCursor(saved);
    for (;;) {
      const rows = await remote.pullChanges(table.name, since, PULL_PAGE);
      if (rows.length === 0) break;
      const last = String(rows[rows.length - 1].updated_at);
      await withoutForeignKeys(db, async () => {
        result.recebidos += await applyRows(db, table, rows);
        await setPreference(db, cursorKey, last);
      });
      if (rows.length < PULL_PAGE) break;
      since = last;
    }
  }

  let after = Number((await getPreference(db, DELETIONS_CURSOR)) ?? 0);
  for (;;) {
    const tombstones = await remote.pullDeletions(after, PULL_PAGE);
    if (tombstones.length === 0) break;
    after = tombstones[tombstones.length - 1].id;
    await withoutForeignKeys(db, async () => {
      for (const tombstone of tombstones) {
        const table = SYNC_TABLES.find((t) => t.name === tombstone.tabela);
        if (!table) continue;
        const key = keyFromRow(table, tombstone.chave);
        const pending = await db.getFirstAsync(
          'SELECT 1 FROM fila_sincronizacao WHERE tabela = ? AND chave = ?',
          table.name,
          serializeKey(table, key),
        );
        if (pending) continue;
        const where = whereKey(table, key);
        const deleted = await db.runAsync(`DELETE FROM ${table.name} WHERE ${where.sql}`, where.params);
        result.excluidos += deleted.changes;
      }
      await setPreference(db, DELETIONS_CURSOR, String(after));
    });
    if (tombstones.length < PULL_PAGE) break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Ciclo completo
// ---------------------------------------------------------------------------

let running: Promise<SyncResult> | null = null;

/** Envia a fila e depois baixa as novidades. Chamadas simultâneas reaproveitam a mesma execução. */
export function syncNow(db: SQLiteDatabase, remote: SyncRemote): Promise<SyncResult> {
  if (!running) {
    running = (async () => {
      const pushed = await pushQueue(db, remote);
      const pulled = await pullChanges(db, remote);
      await setPreference(db, LAST_SYNC_KEY, new Date().toISOString());
      return { ...pushed, ...pulled };
    })().finally(() => {
      running = null;
    });
  }
  return running;
}

/** Apaga os dados locais e os cursores (troca de usuário, ou "baixar tudo de novo"). */
export async function resetLocalData(db: SQLiteDatabase, { keepQueue = false } = {}) {
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.withTransactionAsync(async () => {
      for (const table of DATA_TABLES) {
        // Mantendo a sessão, a conta do usuário logado não pode sumir (é referenciada nas gravações).
        if (keepQueue && table === 'usuarios') continue;
        await db.runAsync(`DELETE FROM ${table}`);
      }
      if (!keepQueue) await db.runAsync('DELETE FROM fila_sincronizacao');
      await db.runAsync("DELETE FROM preferencias WHERE chave LIKE 'sync:%'");
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
}
