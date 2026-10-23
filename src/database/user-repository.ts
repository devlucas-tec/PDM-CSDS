import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { DomainError, isUniqueViolation } from '@/database/errors';
import type { Perfil, Usuario } from '@/database/types';
import { nowIso } from '@/lib/format';
import { generateSalt, hashPassword, verifyPassword } from '@/lib/password';

const USER_COLUMNS = 'id, nome, email, perfil, telefone, created_at';

export async function countUsers(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM usuarios');
  return row?.total ?? 0;
}

export function listUsers(db: SQLiteDatabase) {
  return db.getAllAsync<Usuario>(`SELECT ${USER_COLUMNS} FROM usuarios ORDER BY nome COLLATE NOCASE`);
}

export function listTeachers(db: SQLiteDatabase) {
  return db.getAllAsync<Usuario>(
    `SELECT ${USER_COLUMNS} FROM usuarios WHERE perfil = 'professor' ORDER BY nome COLLATE NOCASE`,
  );
}

export function getUser(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Usuario>(`SELECT ${USER_COLUMNS} FROM usuarios WHERE id = ?`, id);
}

export async function createUser(
  db: SQLiteDatabase,
  input: { nome: string; email: string; senha: string; perfil: Perfil; telefone?: string | null },
  createdBy: number | null,
) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.getFirstAsync('SELECT id FROM usuarios WHERE email = ?', email);
  if (existing) throw new DomainError('Já existe um usuário com este email.', 'email');

  const salt = generateSalt();
  const hash = await hashPassword(input.senha, salt);
  try {
    const result = await db.runAsync(
      'INSERT INTO usuarios (nome, email, senha_hash, senha_salt, perfil, telefone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      input.nome.trim(),
      email,
      hash,
      salt,
      input.perfil,
      input.telefone?.trim() || null,
      nowIso(),
    );
    const id = result.lastInsertRowId;
    await logAudit(db, {
      usuarioId: createdBy ?? id,
      acao: 'criar',
      entidade: 'usuario',
      entidadeId: id,
      descricao: `Usuário ${email} (${input.perfil})`,
    });
    return id;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('Já existe um usuário com este email.', 'email');
    throw error;
  }
}

/** Retorna o usuário se email e senha conferem; caso contrário, null. */
export async function authenticate(db: SQLiteDatabase, email: string, senha: string) {
  const row = await db.getFirstAsync<Usuario & { senha_hash: string; senha_salt: string }>(
    `SELECT ${USER_COLUMNS}, senha_hash, senha_salt FROM usuarios WHERE email = ?`,
    email.trim().toLowerCase(),
  );
  if (!row) return null;
  const ok = await verifyPassword(senha, row.senha_salt, row.senha_hash);
  if (!ok) return null;
  const { senha_hash: _hash, senha_salt: _salt, ...user } = row;
  return user;
}

// ---------- Sessão ----------

export async function startSession(db: SQLiteDatabase, userId: number) {
  await db.runAsync(
    'INSERT OR REPLACE INTO sessao (id, usuario_id, token, created_at) VALUES (1, ?, ?, ?)',
    userId,
    Crypto.randomUUID(),
    nowIso(),
  );
  await logAudit(db, { usuarioId: userId, acao: 'login', entidade: 'sessao' });
}

export function getSessionUser(db: SQLiteDatabase) {
  return db.getFirstAsync<Usuario>(
    `SELECT u.id, u.nome, u.email, u.perfil, u.telefone, u.created_at
     FROM sessao s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = 1`,
  );
}

export async function endSession(db: SQLiteDatabase, userId: number | null) {
  await db.runAsync('DELETE FROM sessao');
  if (userId) await logAudit(db, { usuarioId: userId, acao: 'logout', entidade: 'sessao' });
}
