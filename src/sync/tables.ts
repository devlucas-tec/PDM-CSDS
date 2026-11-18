/**
 * Tabelas sincronizadas com o backend. A ordem importa: é a ordem em que as
 * mudanças baixadas do servidor são aplicadas (pais antes dos filhos).
 */
export type SyncTable = {
  name: SyncTableName;
  /** Colunas da chave primária (iguais no SQLite e no Postgres). */
  pk: readonly string[];
  /**
   * Tabelas imutáveis (histórico e auditoria): o envio usa "insert ... on
   * conflict do nothing", para que reenviar o mesmo registro seja seguro.
   */
  insertOnly?: boolean;
  /** Só baixa do servidor; o app nunca envia (contas são criadas pela Edge Function). */
  pullOnly?: boolean;
};

export type SyncTableName =
  | 'usuarios'
  | 'alunos'
  | 'oficinas'
  | 'oficina_professores'
  | 'oficina_alunos'
  | 'aulas'
  | 'presencas'
  | 'relatorios_comportamento'
  | 'historico'
  | 'auditoria';

export const SYNC_TABLES: readonly SyncTable[] = [
  { name: 'usuarios', pk: ['id'], pullOnly: true },
  { name: 'alunos', pk: ['id'] },
  { name: 'oficinas', pk: ['id'] },
  { name: 'oficina_professores', pk: ['oficina_id', 'professor_id'] },
  { name: 'oficina_alunos', pk: ['oficina_id', 'aluno_id'] },
  { name: 'aulas', pk: ['id'] },
  { name: 'presencas', pk: ['aula_id', 'aluno_id'] },
  { name: 'relatorios_comportamento', pk: ['id'] },
  { name: 'historico', pk: ['id'], insertOnly: true },
  { name: 'auditoria', pk: ['id'], insertOnly: true },
];

const BY_NAME = new Map(SYNC_TABLES.map((table) => [table.name, table]));

export function getSyncTable(name: string) {
  const table = BY_NAME.get(name as SyncTableName);
  if (!table) throw new Error(`Tabela não sincronizada: ${name}`);
  return table;
}

export type RowKey = Record<string, string>;

/** Chave em JSON com as colunas sempre na mesma ordem (usada para comparar registros). */
export function serializeKey(table: SyncTable, key: RowKey) {
  return JSON.stringify(Object.fromEntries(table.pk.map((column) => [column, String(key[column])])));
}

export function keyFromRow(table: SyncTable, row: Record<string, unknown>): RowKey {
  return Object.fromEntries(table.pk.map((column) => [column, String(row[column])]));
}

/** Trecho "a = ? AND b = ?" e os valores da chave, para montar o SQL. */
export function whereKey(table: SyncTable, key: RowKey) {
  return {
    sql: table.pk.map((column) => `${column} = ?`).join(' AND '),
    params: table.pk.map((column) => key[column]),
  };
}
