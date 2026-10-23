import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { canAccessClass, type Actor } from '@/database/class-repository';
import { DomainError } from '@/database/errors';
import type { RelatorioDetalhado, StatusRelatorio } from '@/database/types';
import { nowIso, todayIso } from '@/lib/format';
import { isGestor } from '@/lib/permissions';

const DETAIL_SQL = `
  SELECT r.*, COALESCE(al.nome_social, al.nome) AS aluno_nome, u.nome AS professor_nome,
    o.nome AS oficina_nome, a.data AS aula_data
  FROM relatorios_comportamento r
  JOIN alunos al ON al.id = r.aluno_id
  LEFT JOIN usuarios u ON u.id = r.professor_id
  LEFT JOIN aulas a ON a.id = r.aula_id
  LEFT JOIN oficinas o ON o.id = a.oficina_id`;

export type ReportFilters = {
  status?: StatusRelatorio | null;
  alunoId?: number | null;
  professorId?: number | null;
  aulaId?: number | null;
};

export function listReports(db: SQLiteDatabase, filters: ReportFilters = {}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filters.status) {
    where.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.alunoId) {
    where.push('r.aluno_id = ?');
    params.push(filters.alunoId);
  }
  if (filters.professorId) {
    where.push('r.professor_id = ?');
    params.push(filters.professorId);
  }
  if (filters.aulaId) {
    where.push('r.aula_id = ?');
    params.push(filters.aulaId);
  }
  return db.getAllAsync<RelatorioDetalhado>(
    `${DETAIL_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.created_at DESC, r.id DESC`,
    params,
  );
}

export function getReport(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<RelatorioDetalhado>(`${DETAIL_SQL} WHERE r.id = ?`, id);
}

export async function countNewReports(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM relatorios_comportamento WHERE status = 'novo'");
  return row?.total ?? 0;
}

/** O professor registra um relato sobre o comportamento do aluno na aula. */
export async function createReport(
  db: SQLiteDatabase,
  input: { alunoId: number; aulaId: number; texto: string },
  actor: Actor,
  createdAt = nowIso(),
) {
  const texto = input.texto.trim();
  if (texto.length < 10) throw new DomainError('Escreva o relatório com pelo menos 10 caracteres.', 'texto');
  if (!(await canAccessClass(db, actor, input.aulaId))) throw new DomainError('Você não está vinculado a esta oficina.');

  const enrolled = await db.getFirstAsync(
    `SELECT 1 FROM aulas a WHERE a.id = ? AND (
       EXISTS (SELECT 1 FROM oficina_alunos oa WHERE oa.oficina_id = a.oficina_id AND oa.aluno_id = ?)
       OR EXISTS (SELECT 1 FROM presencas p WHERE p.aula_id = a.id AND p.aluno_id = ?))`,
    input.aulaId,
    input.alunoId,
    input.alunoId,
  );
  if (!enrolled) throw new DomainError('Este aluno não faz parte desta oficina.');

  let id = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO relatorios_comportamento (aluno_id, aula_id, professor_id, texto, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.alunoId,
      input.aulaId,
      actor.id,
      texto,
      createdAt,
      createdAt,
    );
    id = result.lastInsertRowId;
    await logAudit(db, { usuarioId: actor.id, acao: 'criar', entidade: 'relatorio', entidadeId: id });
  });
  return id;
}

function assertGestor(actor: Actor) {
  if (!isGestor(actor.perfil)) throw new DomainError('Apenas a coordenação pode acompanhar os relatórios.');
}

/** A coordenação marca o relatório como lido (ao abrir). */
export async function markReportRead(db: SQLiteDatabase, id: number, actor: Actor) {
  assertGestor(actor);
  await db.runAsync(
    "UPDATE relatorios_comportamento SET status = 'lido', updated_at = ? WHERE id = ? AND status = 'novo'",
    nowIso(),
    id,
  );
}

/**
 * A coordenação registra que entrou em contato com os responsáveis. O contato
 * também entra no histórico do aluno, para ficar na linha do tempo.
 */
export async function registerGuardianContact(db: SQLiteDatabase, id: number, observacao: string, actor: Actor) {
  assertGestor(actor);
  const texto = observacao.trim();
  if (texto.length < 5) throw new DomainError('Descreva o contato realizado.', 'observacao');
  const report = await getReport(db, id);
  if (!report) throw new DomainError('Relatório não encontrado.');

  await db.withTransactionAsync(async () => {
    const now = nowIso();
    await db.runAsync(
      "UPDATE relatorios_comportamento SET status = 'contato_realizado', observacao_coordenacao = ?, updated_at = ? WHERE id = ?",
      texto,
      now,
      id,
    );
    await db.runAsync(
      'INSERT INTO historico (aluno_id, tipo, descricao, data_evento, usuario_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      report.aluno_id,
      'Acompanhamento social',
      `Contato com responsáveis sobre relatório de comportamento${report.oficina_nome ? ` (${report.oficina_nome})` : ''}: ${texto}`,
      todayIso(),
      actor.id,
      now,
    );
    await logAudit(db, { usuarioId: actor.id, acao: 'editar', entidade: 'relatorio', entidadeId: id, descricao: 'Contato com responsáveis' });
  });
}
