import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { canAccessClass, getClass, type Actor } from '@/database/class-repository';
import { DomainError } from '@/database/errors';
import type { ChamadaItem, FrequenciaOficina } from '@/database/types';
import { nowIso, todayIso } from '@/lib/format';

/**
 * Lista de chamada: alunos matriculados na oficina da aula (e quem tiver
 * presença registrada nela, mesmo que tenha saído da oficina depois).
 */
export function getAttendanceList(db: SQLiteDatabase, aulaId: number) {
  return db.getAllAsync<ChamadaItem>(
    `SELECT al.id AS aluno_id, al.nome, al.nome_social, al.data_nascimento, p.presente,
       (SELECT COUNT(*) FROM relatorios_comportamento r WHERE r.aluno_id = al.id AND r.aula_id = ?) AS relatorios
     FROM alunos al
     LEFT JOIN presencas p ON p.aluno_id = al.id AND p.aula_id = ?
     WHERE al.id IN (
       SELECT oa.aluno_id FROM oficina_alunos oa JOIN aulas a ON a.oficina_id = oa.oficina_id WHERE a.id = ?
       UNION SELECT aluno_id FROM presencas WHERE aula_id = ?
     )
     ORDER BY COALESCE(al.nome_social, al.nome) COLLATE NOCASE`,
    aulaId,
    aulaId,
    aulaId,
    aulaId,
  );
}

/** Motivo pelo qual a chamada não pode ser feita agora, ou null se pode. */
export async function attendanceBlockReason(db: SQLiteDatabase, aulaId: number, actor: Actor, today = todayIso()) {
  const aula = await getClass(db, aulaId);
  if (!aula) return 'Aula não encontrada.';
  if (!(await canAccessClass(db, actor, aulaId))) return 'Você não está vinculado a esta oficina.';
  if (aula.status === 'cancelada') return 'Esta aula foi cancelada.';
  if (aula.data > today) return 'A chamada só pode ser feita no dia da aula.';
  return null;
}

export async function saveAttendance(
  db: SQLiteDatabase,
  aulaId: number,
  entries: { alunoId: number; presente: boolean }[],
  actor: Actor,
) {
  const blocked = await attendanceBlockReason(db, aulaId, actor);
  if (blocked) throw new DomainError(blocked);
  if (entries.length === 0) throw new DomainError('Nenhum aluno matriculado nesta oficina.');

  await db.withTransactionAsync(async () => {
    const now = nowIso();
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO presencas (aula_id, aluno_id, presente, registrado_por, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (aula_id, aluno_id) DO UPDATE SET presente = excluded.presente,
           registrado_por = excluded.registrado_por, updated_at = excluded.updated_at`,
        aulaId,
        entry.alunoId,
        entry.presente ? 1 : 0,
        actor.id,
        now,
      );
    }
    const presentes = entries.filter((e) => e.presente).length;
    await logAudit(db, {
      usuarioId: actor.id,
      acao: 'editar',
      entidade: 'chamada',
      entidadeId: aulaId,
      descricao: `${presentes} de ${entries.length} presentes`,
    });
  });
}

/** Frequência de um aluno, por oficina. */
export function getStudentAttendance(db: SQLiteDatabase, alunoId: number) {
  return db.getAllAsync<FrequenciaOficina>(
    `SELECT o.id AS oficina_id, o.nome AS oficina_nome, COUNT(*) AS total, SUM(p.presente) AS presentes
     FROM presencas p JOIN aulas a ON a.id = p.aula_id JOIN oficinas o ON o.id = a.oficina_id
     WHERE p.aluno_id = ?
     GROUP BY o.id ORDER BY o.nome COLLATE NOCASE`,
    alunoId,
  );
}

export type AttendanceEntry = { aula_id: number; data: string; oficina_nome: string; presente: 0 | 1 };

/** Últimas chamadas em que o aluno apareceu (presença ou falta). */
export function getRecentAttendance(db: SQLiteDatabase, alunoId: number, limit = 8) {
  return db.getAllAsync<AttendanceEntry>(
    `SELECT a.id AS aula_id, a.data, o.nome AS oficina_nome, p.presente
     FROM presencas p JOIN aulas a ON a.id = p.aula_id JOIN oficinas o ON o.id = a.oficina_id
     WHERE p.aluno_id = ? ORDER BY a.data DESC, a.hora_inicio DESC LIMIT ?`,
    alunoId,
    limit,
  );
}

/** Totais de presença por aluno (usado no dashboard). */
export async function getAttendanceTotals(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ aluno_id: number; total: number; presentes: number }>(
    'SELECT aluno_id, COUNT(*) AS total, SUM(presente) AS presentes FROM presencas GROUP BY aluno_id',
  );
  return new Map(rows.map((row) => [row.aluno_id, { total: row.total, presentes: row.presentes }]));
}
