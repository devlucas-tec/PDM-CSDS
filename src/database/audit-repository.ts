import type { SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '@/lib/format';

export type AuditAction = 'criar' | 'editar' | 'excluir' | 'login' | 'logout';

export async function logAudit(
  db: SQLiteDatabase,
  entry: { usuarioId: number | null; acao: AuditAction; entidade: string; entidadeId?: number | null; descricao?: string },
) {
  await db.runAsync(
    'INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, descricao, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    entry.usuarioId,
    entry.acao,
    entry.entidade,
    entry.entidadeId ?? null,
    entry.descricao ?? null,
    nowIso(),
  );
}

export type AuditEntry = {
  id: number;
  acao: AuditAction;
  entidade: string;
  descricao: string | null;
  usuario_nome: string | null;
  created_at: string;
};

export function listRecentAudit(db: SQLiteDatabase, limit = 20) {
  return db.getAllAsync<AuditEntry>(
    `SELECT a.id, a.acao, a.entidade, a.descricao, a.created_at, u.nome AS usuario_nome
     FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    limit,
  );
}
