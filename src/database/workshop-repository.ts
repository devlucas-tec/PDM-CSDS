import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { DomainError, isUniqueViolation } from '@/database/errors';
import type { Oficina, OficinaResumo } from '@/database/types';
import { nowIso } from '@/lib/format';

const SUMMARY_SQL = `
  SELECT o.*,
    (SELECT GROUP_CONCAT(u.nome, ', ') FROM oficina_professores op JOIN usuarios u ON u.id = op.professor_id
      WHERE op.oficina_id = o.id) AS professores,
    (SELECT COUNT(*) FROM oficina_alunos oa WHERE oa.oficina_id = o.id) AS total_alunos,
    (SELECT COUNT(*) FROM aulas a WHERE a.oficina_id = o.id) AS total_aulas
  FROM oficinas o`;

export function listWorkshops(db: SQLiteDatabase) {
  return db.getAllAsync<OficinaResumo>(`${SUMMARY_SQL} ORDER BY o.nome COLLATE NOCASE`);
}

/** Oficinas em que o professor está vinculado. */
export function listTeacherWorkshops(db: SQLiteDatabase, professorId: number) {
  return db.getAllAsync<OficinaResumo>(
    `${SUMMARY_SQL} WHERE o.id IN (SELECT oficina_id FROM oficina_professores WHERE professor_id = ?)
     ORDER BY o.nome COLLATE NOCASE`,
    professorId,
  );
}

/** Oficinas em que o aluno está matriculado. */
export function listStudentWorkshops(db: SQLiteDatabase, alunoId: number) {
  return db.getAllAsync<Oficina>(
    `SELECT o.* FROM oficinas o JOIN oficina_alunos oa ON oa.oficina_id = o.id
     WHERE oa.aluno_id = ? ORDER BY o.nome COLLATE NOCASE`,
    alunoId,
  );
}

export async function getWorkshop(db: SQLiteDatabase, id: number) {
  const oficina = await db.getFirstAsync<Oficina>('SELECT * FROM oficinas WHERE id = ?', id);
  if (!oficina) return null;
  const [professores, alunos] = await Promise.all([
    db.getAllAsync<{ id: number }>('SELECT professor_id AS id FROM oficina_professores WHERE oficina_id = ?', id),
    db.getAllAsync<{ id: number }>('SELECT aluno_id AS id FROM oficina_alunos WHERE oficina_id = ?', id),
  ]);
  return { oficina, professorIds: professores.map((p) => p.id), alunoIds: alunos.map((a) => a.id) };
}

export type WorkshopInput = {
  nome: string;
  descricao: string | null;
  local: string | null;
  professorIds: number[];
  alunoIds: number[];
};

/** Cria ou atualiza a oficina e substitui os vínculos de professores e alunos. */
export async function saveWorkshop(db: SQLiteDatabase, id: number | null, input: WorkshopInput, userId: number) {
  const nome = input.nome.trim().replace(/\s+/g, ' ');
  const duplicate = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM oficinas WHERE nome = ? AND id <> ?',
    nome,
    id ?? -1,
  );
  if (duplicate) throw new DomainError('Já existe uma oficina com este nome.', 'nome');

  let savedId = id ?? 0;
  try {
    await db.withTransactionAsync(async () => {
      const now = nowIso();
      if (id) {
        await db.runAsync('UPDATE oficinas SET nome = ?, descricao = ?, local = ? WHERE id = ?', nome, input.descricao, input.local, id);
      } else {
        const result = await db.runAsync(
          'INSERT INTO oficinas (nome, descricao, local, created_at) VALUES (?, ?, ?, ?)',
          nome,
          input.descricao,
          input.local,
          now,
        );
        savedId = result.lastInsertRowId;
      }

      await db.runAsync('DELETE FROM oficina_professores WHERE oficina_id = ?', savedId);
      for (const professorId of new Set(input.professorIds)) {
        await db.runAsync('INSERT INTO oficina_professores (oficina_id, professor_id) VALUES (?, ?)', savedId, professorId);
      }

      // Mantém a data de matrícula de quem já estava; insere só os novos.
      const alunoIds = [...new Set(input.alunoIds)];
      const placeholders = alunoIds.map(() => '?').join(', ');
      await db.runAsync(
        `DELETE FROM oficina_alunos WHERE oficina_id = ?${alunoIds.length ? ` AND aluno_id NOT IN (${placeholders})` : ''}`,
        [savedId, ...alunoIds],
      );
      for (const alunoId of alunoIds) {
        await db.runAsync(
          'INSERT OR IGNORE INTO oficina_alunos (oficina_id, aluno_id, created_at) VALUES (?, ?, ?)',
          savedId,
          alunoId,
          now,
        );
      }

      await logAudit(db, { usuarioId: userId, acao: id ? 'editar' : 'criar', entidade: 'oficina', entidadeId: savedId, descricao: nome });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('Já existe uma oficina com este nome.', 'nome');
    throw error;
  }
  return savedId;
}

export async function deleteWorkshop(db: SQLiteDatabase, id: number, userId: number) {
  const oficina = await db.getFirstAsync<{ nome: string }>('SELECT nome FROM oficinas WHERE id = ?', id);
  if (!oficina) throw new DomainError('Oficina não encontrada.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM oficinas WHERE id = ?', id);
    await logAudit(db, { usuarioId: userId, acao: 'excluir', entidade: 'oficina', entidadeId: id, descricao: oficina.nome });
  });
}
