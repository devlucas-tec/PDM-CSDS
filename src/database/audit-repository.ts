import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/id';
import { nowIso } from '@/lib/format';
import { enqueueId } from '@/sync/outbox';

export type AuditAction = 'criar' | 'editar' | 'excluir' | 'login' | 'logout';

export async function logAudit(
  db: SQLiteDatabase,
  entry: { usuarioId: string | null; acao: AuditAction; entidade: string; entidadeId?: string | null; descricao?: string },
) {
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    'INSERT INTO auditoria (id, usuario_id, acao, entidade, entidade_id, descricao, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    entry.usuarioId,
    entry.acao,
    entry.entidade,
    entry.entidadeId ?? null,
    entry.descricao ?? null,
    now,
    now,
  );
  await enqueueId(db, 'auditoria', 'inserir', id);
}

export type AuditEntry = {
  id: string;
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
