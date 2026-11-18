import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { DomainError } from '@/database/errors';
import type { HistoricoInput, RegistroHistorico } from '@/database/types';
import { nowIso } from '@/lib/format';
import { newId } from '@/lib/id';
import { enqueueId } from '@/sync/outbox';

/** Linha do tempo do aluno, do registro mais recente para o mais antigo. */
export function listHistory(db: SQLiteDatabase, alunoId: string) {
  return db.getAllAsync<RegistroHistorico>(
    `SELECT h.*, u.nome AS usuario_nome
     FROM historico h LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.aluno_id = ?
     ORDER BY h.data_evento DESC, h.created_at DESC, h.id DESC`,
    alunoId,
  );
}

/**
 * Grava um registro na linha do tempo e o coloca na fila de envio. Deve ser
 * chamado dentro da transação de quem o gerou.
 */
export async function insertHistory(
  db: SQLiteDatabase,
  entry: { alunoId: string; tipo: string; descricao: string; dataEvento: string; usuarioId: string | null; createdAt?: string },
) {
  const id = newId();
  const now = entry.createdAt ?? nowIso();
  await db.runAsync(
    'INSERT INTO historico (id, aluno_id, tipo, descricao, data_evento, usuario_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    entry.alunoId,
    entry.tipo,
    entry.descricao,
    entry.dataEvento,
    entry.usuarioId,
    now,
    now,
  );
  await enqueueId(db, 'historico', 'inserir', id);
  return id;
}

/**
 * Registros de histórico só podem ser criados. Não existe função de editar ou
 * apagar, e os bancos (local e servidor) têm triggers que bloqueiam UPDATE.
 */
export async function addHistory(db: SQLiteDatabase, alunoId: string, input: HistoricoInput, userId: string) {
  const aluno = await db.getFirstAsync<{ nome: string }>('SELECT nome FROM alunos WHERE id = ?', alunoId);
  if (!aluno) throw new DomainError('Aluno não encontrado.');

  let id = '';
  await db.withTransactionAsync(async () => {
    id = await insertHistory(db, {
      alunoId,
      tipo: input.tipo,
      descricao: input.descricao.trim(),
      dataEvento: input.data_evento,
      usuarioId: userId,
    });
    await logAudit(db, {
      usuarioId: userId,
      acao: 'criar',
      entidade: 'historico',
      entidadeId: id,
      descricao: `${input.tipo} — ${aluno.nome}`,
    });
  });
  return id;
}
