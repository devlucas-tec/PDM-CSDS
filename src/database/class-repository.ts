import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { DomainError } from '@/database/errors';
import type { AulaDetalhada, StatusAula, Usuario } from '@/database/types';
import { generateDates } from '@/lib/calendar';
import { nowIso } from '@/lib/format';
import { isGestor } from '@/lib/permissions';

/** Quem está executando a ação (para checar permissões no próprio repositório). */
export type Actor = Pick<Usuario, 'id' | 'perfil'>;

const DETAIL_SQL = `
  SELECT a.*, o.nome AS oficina_nome, o.local AS oficina_local,
    (SELECT GROUP_CONCAT(u.nome, ', ') FROM oficina_professores op JOIN usuarios u ON u.id = op.professor_id
      WHERE op.oficina_id = a.oficina_id) AS professores,
    (SELECT COUNT(*) FROM oficina_alunos oa WHERE oa.oficina_id = a.oficina_id) AS total_matriculados,
    (SELECT COUNT(*) FROM presencas p WHERE p.aula_id = a.id) AS total_registrados,
    (SELECT COUNT(*) FROM presencas p WHERE p.aula_id = a.id AND p.presente = 1) AS total_presentes
  FROM aulas a JOIN oficinas o ON o.id = a.oficina_id`;

export type ClassFilters = {
  from: string;
  to: string;
  oficinaId?: number | null;
  /** Professor: só as aulas das oficinas em que ele está vinculado. */
  professorId?: number | null;
};

export function listClasses(db: SQLiteDatabase, filters: ClassFilters) {
  const where = ['a.data BETWEEN ? AND ?'];
  const params: (string | number)[] = [filters.from, filters.to];
  if (filters.oficinaId) {
    where.push('a.oficina_id = ?');
    params.push(filters.oficinaId);
  }
  if (filters.professorId) {
    where.push('a.oficina_id IN (SELECT oficina_id FROM oficina_professores WHERE professor_id = ?)');
    params.push(filters.professorId);
  }
  return db.getAllAsync<AulaDetalhada>(
    `${DETAIL_SQL} WHERE ${where.join(' AND ')} ORDER BY a.data, a.hora_inicio, o.nome`,
    params,
  );
}

export function getClass(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<AulaDetalhada>(`${DETAIL_SQL} WHERE a.id = ?`, id);
}

/** O professor só acessa aulas das oficinas em que está vinculado; gestores acessam todas. */
export async function canAccessClass(db: SQLiteDatabase, actor: Actor, aulaId: number) {
  if (isGestor(actor.perfil)) return true;
  const row = await db.getFirstAsync(
    `SELECT 1 FROM aulas a JOIN oficina_professores op ON op.oficina_id = a.oficina_id
     WHERE a.id = ? AND op.professor_id = ?`,
    aulaId,
    actor.id,
  );
  return row !== null;
}

function assertGestor(actor: Actor) {
  if (!isGestor(actor.perfil)) throw new DomainError('Apenas a coordenação pode alterar o calendário.');
}

export type PlanInput = {
  oficinaId: number;
  inicio: string;
  fim: string;
  diasSemana: number[];
  horaInicio: string;
  horaFim: string;
};

/**
 * Monta o calendário de uma oficina: cria uma aula em cada data do período
 * que cai nos dias da semana escolhidos. Datas que já têm aula dessa oficina
 * são ignoradas, para não duplicar. Retorna quantas aulas foram criadas.
 */
export async function planClasses(db: SQLiteDatabase, input: PlanInput, actor: Actor) {
  assertGestor(actor);
  if (input.horaFim <= input.horaInicio) throw new DomainError('O horário de término deve ser depois do início.', 'horaFim');
  const dates = generateDates(input.inicio, input.fim, input.diasSemana);
  if (dates.length === 0) throw new DomainError('Nenhuma data no período para os dias escolhidos.');

  let created = 0;
  await db.withTransactionAsync(async () => {
    const existing = new Set(
      (
        await db.getAllAsync<{ data: string }>(
          'SELECT data FROM aulas WHERE oficina_id = ? AND data BETWEEN ? AND ?',
          input.oficinaId,
          input.inicio,
          input.fim,
        )
      ).map((row) => row.data),
    );
    const now = nowIso();
    for (const date of dates) {
      if (existing.has(date)) continue;
      await db.runAsync(
        'INSERT INTO aulas (oficina_id, data, hora_inicio, hora_fim, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        input.oficinaId,
        date,
        input.horaInicio,
        input.horaFim,
        now,
        now,
        actor.id,
      );
      created++;
    }
    await logAudit(db, {
      usuarioId: actor.id,
      acao: 'criar',
      entidade: 'calendario',
      entidadeId: input.oficinaId,
      descricao: `${created} aulas planejadas (${input.inicio} a ${input.fim})`,
    });
  });
  return created;
}

export type ClassChange = {
  data: string;
  horaInicio: string;
  horaFim: string;
  cancelada: boolean;
  justificativa: string | null;
};

/**
 * Coordenação remarca ou cancela uma aula (ex.: professor avisou que não
 * poderá comparecer). Qualquer mudança exige justificativa. A data original é
 * guardada na primeira remarcação.
 */
export async function updateClass(db: SQLiteDatabase, id: number, change: ClassChange, actor: Actor) {
  assertGestor(actor);
  const current = await getClass(db, id);
  if (!current) throw new DomainError('Aula não encontrada.');
  if (change.horaFim <= change.horaInicio) throw new DomainError('O horário de término deve ser depois do início.', 'horaFim');

  const moved = change.data !== current.data || change.horaInicio !== current.hora_inicio || change.horaFim !== current.hora_fim;
  if ((moved || change.cancelada) && current.total_registrados > 0) {
    throw new DomainError('Esta aula já tem chamada registrada e não pode ser remarcada ou cancelada.');
  }

  const status: StatusAula = change.cancelada ? 'cancelada' : moved || current.data_original ? 'remarcada' : 'agendada';
  const justificativa = change.justificativa?.trim() || null;
  if (status !== 'agendada' && !justificativa) {
    throw new DomainError('Informe a justificativa da mudança.', 'justificativa');
  }
  const dataOriginal = moved ? (current.data_original ?? current.data) : current.data_original;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE aulas SET data = ?, hora_inicio = ?, hora_fim = ?, status = ?, data_original = ?, justificativa = ?,
         updated_at = ?, updated_by = ? WHERE id = ?`,
      change.data,
      change.horaInicio,
      change.horaFim,
      status,
      dataOriginal,
      status === 'agendada' ? null : justificativa,
      nowIso(),
      actor.id,
      id,
    );
    await logAudit(db, {
      usuarioId: actor.id,
      acao: 'editar',
      entidade: 'aula',
      entidadeId: id,
      descricao: `${current.oficina_nome} — ${status}${justificativa ? `: ${justificativa}` : ''}`,
    });
  });
  return status;
}

export async function deleteClass(db: SQLiteDatabase, id: number, actor: Actor) {
  assertGestor(actor);
  const current = await getClass(db, id);
  if (!current) throw new DomainError('Aula não encontrada.');
  if (current.total_registrados > 0) throw new DomainError('Esta aula já tem chamada registrada e não pode ser excluída.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM aulas WHERE id = ?', id);
    await logAudit(db, { usuarioId: actor.id, acao: 'excluir', entidade: 'aula', entidadeId: id, descricao: `${current.oficina_nome} ${current.data}` });
  });
}
