import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { DomainError } from '@/database/errors';
import type { HistoricoInput, RegistroHistorico } from '@/database/types';
import { nowIso } from '@/lib/format';

/** Linha do tempo do aluno, do registro mais recente para o mais antigo. */
export function listHistory(db: SQLiteDatabase, alunoId: number) {
  return db.getAllAsync<RegistroHistorico>(
    `SELECT h.*, u.nome AS usuario_nome
     FROM historico h LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.aluno_id = ?
     ORDER BY h.data_evento DESC, h.created_at DESC, h.id DESC`,
    alunoId,
  );
}

/**
 * Registros de histórico só podem ser criados. Não existe função de editar ou
 * apagar, e o banco tem um trigger que bloqueia UPDATE, para garantir a
 * rastreabilidade.
 */
export async function addHistory(db: SQLiteDatabase, alunoId: number, input: HistoricoInput, userId: number) {
  const aluno = await db.getFirstAsync<{ nome: string }>('SELECT nome FROM alunos WHERE id = ?', alunoId);
  if (!aluno) throw new DomainError('Aluno não encontrado.');

  const result = await db.runAsync(
    'INSERT INTO historico (aluno_id, tipo, descricao, data_evento, usuario_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    alunoId,
    input.tipo,
    input.descricao.trim(),
    input.data_evento,
    userId,
    nowIso(),
  );
  await logAudit(db, {
    usuarioId: userId,
    acao: 'criar',
    entidade: 'historico',
    entidadeId: result.lastInsertRowId,
    descricao: `${input.tipo} — ${aluno.nome}`,
  });
  return result.lastInsertRowId;
}
