import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

type Param = string | number | null;

function normalize(params: unknown[]): Param[] {
  const flat = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
  return flat.map((value) => (value === undefined ? null : (value as Param)));
}

/**
 * Implementa, sobre o SQLite embutido do Node, os métodos do `SQLiteDatabase`
 * do expo-sqlite que os repositórios usam. Assim os testes executam o SQL de
 * verdade (migrações, constraints, triggers) sem precisar de um celular.
 */
export function openTestDatabase(path = ':memory:') {
  const raw = new DatabaseSync(path);

  const db = {
    async execAsync(source: string) {
      raw.exec(source);
    },
    async runAsync(source: string, ...params: unknown[]) {
      const result = raw.prepare(source).run(...normalize(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync<T>(source: string, ...params: unknown[]) {
      return raw.prepare(source).all(...normalize(params)) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: unknown[]) {
      return (raw.prepare(source).get(...normalize(params)) ?? null) as T | null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      raw.close();
    },
  };

  return db as unknown as SQLiteDatabase & { close: () => void };
}
