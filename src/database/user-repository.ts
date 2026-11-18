import type { SQLiteDatabase } from 'expo-sqlite';

import type { Usuario } from '@/database/types';

/**
 * Cópia local das contas da equipe. As contas em si (email e senha) ficam no
 * Supabase Auth e são criadas pela Edge Function `gerenciar-usuarios`; aqui o
 * app só lê nomes e perfis, que chegam pela sincronização.
 */

const USER_COLUMNS = 'id, nome, email, perfil, telefone, created_at';

export function listUsers(db: SQLiteDatabase) {
  return db.getAllAsync<Usuario>(`SELECT ${USER_COLUMNS} FROM usuarios ORDER BY nome COLLATE NOCASE`);
}

export function listTeachers(db: SQLiteDatabase) {
  return db.getAllAsync<Usuario>(
    `SELECT ${USER_COLUMNS} FROM usuarios WHERE perfil = 'professor' ORDER BY nome COLLATE NOCASE`,
  );
}

export function getUser(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Usuario>(`SELECT ${USER_COLUMNS} FROM usuarios WHERE id = ?`, id);
}

export function findUserByEmail(db: SQLiteDatabase, email: string) {
  return db.getFirstAsync<Usuario>(`SELECT ${USER_COLUMNS} FROM usuarios WHERE email = ?`, email.trim().toLowerCase());
}

/** Grava (ou atualiza) a cópia local de uma conta recebida do servidor. */
export async function saveLocalUser(db: SQLiteDatabase, user: Usuario & { updated_at?: string }) {
  await db.runAsync(
    `INSERT INTO usuarios (id, nome, email, perfil, telefone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
       telefone = excluded.telefone, updated_at = excluded.updated_at`,
    user.id,
    user.nome,
    user.email,
    user.perfil,
    user.telefone,
    user.created_at,
    user.updated_at ?? user.created_at,
  );
}
