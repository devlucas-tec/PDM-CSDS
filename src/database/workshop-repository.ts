import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { DomainError, isUniqueViolation } from '@/database/errors';
import type { Oficina, OficinaResumo } from '@/database/types';
import { nowIso } from '@/lib/format';
import { newId } from '@/lib/id';
import { enqueue, enqueueId } from '@/sync/outbox';

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
export function listTeacherWorkshops(db: SQLiteDatabase, professorId: string) {
  return db.getAllAsync<OficinaResumo>(
    `${SUMMARY_SQL} WHERE o.id IN (SELECT oficina_id FROM oficina_professores WHERE professor_id = ?)
     ORDER BY o.nome COLLATE NOCASE`,
    professorId,
  );
}

/** Oficinas em que o aluno está matriculado. */
export function listStudentWorkshops(db: SQLiteDatabase, alunoId: string) {
  return db.getAllAsync<Oficina>(
    `SELECT o.* FROM oficinas o JOIN oficina_alunos oa ON oa.oficina_id = o.id
     WHERE oa.aluno_id = ? ORDER BY o.nome COLLATE NOCASE`,
    alunoId,
  );
}

export async function getWorkshop(db: SQLiteDatabase, id: string) {
  const oficina = await db.getFirstAsync<Oficina>('SELECT * FROM oficinas WHERE id = ?', id);
  if (!oficina) return null;
  const [professores, alunos] = await Promise.all([
    db.getAllAsync<{ id: string }>('SELECT professor_id AS id FROM oficina_professores WHERE oficina_id = ?', id),
    db.getAllAsync<{ id: string }>('SELECT aluno_id AS id FROM oficina_alunos WHERE oficina_id = ?', id),
  ]);
  return { oficina, professorIds: professores.map((p) => p.id), alunoIds: alunos.map((a) => a.id) };
}

export type WorkshopInput = {
  nome: string;
  descricao: string | null;
  local: string | null;
  professorIds: string[];
  alunoIds: string[];
};

/** Cria ou atualiza a oficina e sincroniza os vínculos de professores e alunos. */
export async function saveWorkshop(db: SQLiteDatabase, id: string | null, input: WorkshopInput, userId: string) {
  const nome = input.nome.trim().replace(/\s+/g, ' ');
  const duplicate = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM oficinas WHERE nome = ? AND id <> ?',
    nome,
    id ?? '',
  );
  if (duplicate) throw new DomainError('Já existe uma oficina com este nome.', 'nome');

  const savedId = id ?? newId();
  try {
    await db.withTransactionAsync(async () => {
      const now = nowIso();
      if (id) {
        await db.runAsync(
          'UPDATE oficinas SET nome = ?, descricao = ?, local = ?, updated_at = ? WHERE id = ?',
          nome,
          input.descricao,
          input.local,
          now,
          id,
        );
      } else {
        await db.runAsync(
          'INSERT INTO oficinas (id, nome, descricao, local, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          savedId,
          nome,
          input.descricao,
          input.local,
          now,
          now,
        );
      }
      await enqueueId(db, 'oficinas', 'salvar', savedId);

      // Vínculos: só envia o que mudou (removidos e novos), e cada mudança vai para a fila.
      await syncLinks(db, 'oficina_professores', 'professor_id', savedId, input.professorIds, now);
      await syncLinks(db, 'oficina_alunos', 'aluno_id', savedId, input.alunoIds, now);

      await logAudit(db, { usuarioId: userId, acao: id ? 'editar' : 'criar', entidade: 'oficina', entidadeId: savedId, descricao: nome });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('Já existe uma oficina com este nome.', 'nome');
    throw error;
  }
  return savedId;
}

async function syncLinks(
  db: SQLiteDatabase,
  tabela: 'oficina_professores' | 'oficina_alunos',
  coluna: 'professor_id' | 'aluno_id',
  oficinaId: string,
  desired: string[],
  now: string,
) {
  const current = new Set(
    (await db.getAllAsync<{ id: string }>(`SELECT ${coluna} AS id FROM ${tabela} WHERE oficina_id = ?`, oficinaId)).map((row) => row.id),
  );
  const wanted = new Set(desired);
  for (const linked of current) {
    if (wanted.has(linked)) continue;
    await db.runAsync(`DELETE FROM ${tabela} WHERE oficina_id = ? AND ${coluna} = ?`, oficinaId, linked);
    await enqueue(db, tabela, 'excluir', { oficina_id: oficinaId, [coluna]: linked });
  }
  // Mantém a data de vínculo de quem já estava; insere só os novos.
  for (const linked of wanted) {
    if (current.has(linked)) continue;
    await db.runAsync(
      `INSERT INTO ${tabela} (oficina_id, ${coluna}, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      oficinaId,
      linked,
      now,
      now,
    );
    await enqueue(db, tabela, 'salvar', { oficina_id: oficinaId, [coluna]: linked });
  }
}

export async function deleteWorkshop(db: SQLiteDatabase, id: string, userId: string) {
  const oficina = await db.getFirstAsync<{ nome: string }>('SELECT nome FROM oficinas WHERE id = ?', id);
  if (!oficina) throw new DomainError('Oficina não encontrada.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM oficinas WHERE id = ?', id);
    await enqueueId(db, 'oficinas', 'excluir', id);
    await logAudit(db, { usuarioId: userId, acao: 'excluir', entidade: 'oficina', entidadeId: id, descricao: oficina.nome });
  });
}
