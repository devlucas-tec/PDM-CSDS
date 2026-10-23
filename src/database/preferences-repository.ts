import type { SQLiteDatabase } from 'expo-sqlite';

export async function getPreference(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM preferencias WHERE chave = ?', key);
  return row?.valor ?? null;
}

export async function setPreference(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT OR REPLACE INTO preferencias (chave, valor) VALUES (?, ?)', key, value);
}
