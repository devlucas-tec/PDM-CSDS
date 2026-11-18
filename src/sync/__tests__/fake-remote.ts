import { RemoteError, type SyncRemote, type Tombstone } from '@/sync/remote';
import { getSyncTable, keyFromRow, serializeKey, type RowKey, type SyncTableName } from '@/sync/tables';

type Row = Record<string, unknown>;

/**
 * Backend em memória que se comporta como o Supabase para o sincronizador:
 * upsert por chave, updated_at definido pelo "relógio do servidor", registro
 * de exclusões e simulação de queda de conexão ou recusa de um registro.
 */
export class FakeRemote implements SyncRemote {
  online = true;
  /** Lista de chamadas recebidas, para conferir a ordem de envio. */
  calls: string[] = [];
  private tables = new Map<string, Map<string, Row>>();
  private tombstones: Tombstone[] = [];
  private clock = Date.parse('2026-01-01T00:00:00.000Z');
  /** Derruba a conexão depois de N pedidos bem-sucedidos. */
  failAfter: number | null = null;
  /** Recusa de vez os registros para os quais a função retornar true. */
  reject: ((table: SyncTableName, row: Row) => boolean) | null = null;

  private table(name: string) {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  private tick() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  private guard() {
    if (!this.online) throw new RemoteError('Network request failed', true);
    if (this.failAfter !== null) {
      if (this.failAfter <= 0) {
        this.online = false;
        throw new RemoteError('Network request failed', true);
      }
      this.failAfter--;
    }
  }

  rows(name: SyncTableName) {
    return [...this.table(name).values()];
  }

  /** Alteração feita "por outro aparelho" direto no servidor. */
  serverWrite(name: SyncTableName, row: Row) {
    const table = getSyncTable(name);
    this.table(name).set(serializeKey(table, keyFromRow(table, row)), { ...row, updated_at: this.tick() });
  }

  serverDelete(name: SyncTableName, key: RowKey) {
    const table = getSyncTable(name);
    this.table(name).delete(serializeKey(table, key));
    this.tombstones.push({ id: this.tombstones.length + 1, tabela: name, chave: key });
  }

  async upsert(name: SyncTableName, rows: Row[], { ignoreDuplicates }: { onConflict: string; ignoreDuplicates: boolean }) {
    this.guard();
    const table = getSyncTable(name);
    if (this.reject && rows.some((row) => this.reject!(name, row))) {
      throw new RemoteError('new row violates row-level security policy', false);
    }
    this.calls.push(`${ignoreDuplicates ? 'inserir' : 'salvar'} ${name} x${rows.length}`);
    for (const row of rows) {
      const key = serializeKey(table, keyFromRow(table, row));
      if (ignoreDuplicates && this.table(name).has(key)) continue;
      this.table(name).set(key, { ...row, updated_at: this.tick() });
    }
  }

  async remove(name: SyncTableName, keys: RowKey[]) {
    this.guard();
    this.calls.push(`excluir ${name} x${keys.length}`);
    for (const key of keys) this.serverDelete(name, key);
  }

  async pullChanges(name: SyncTableName, since: string | null, limit: number) {
    this.guard();
    return this.rows(name)
      .filter((row) => !since || String(row.updated_at) > since)
      .sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))
      .slice(0, limit);
  }

  async pullDeletions(after: number, limit: number) {
    this.guard();
    return this.tombstones.filter((t) => t.id > after).slice(0, limit);
  }
}
