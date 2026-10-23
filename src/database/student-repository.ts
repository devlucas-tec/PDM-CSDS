import type { SQLiteDatabase } from 'expo-sqlite';

import { logAudit } from '@/database/audit-repository';
import { DomainError, isUniqueViolation } from '@/database/errors';
import type { Aluno, AlunoDetalhado, AlunoInput } from '@/database/types';
import { nowIso, todayIso } from '@/lib/format';

/**
 * Objeto com todas as chaves de AlunoInput. Se um campo novo for adicionado ao
 * tipo e esquecido aqui, o TypeScript acusa erro — assim INSERT e UPDATE nunca
 * ficam desatualizados.
 */
const FIELD_MAP: Record<keyof AlunoInput, true> = {
  nome: true, nome_social: true, cpf: true, rg: true, nacionalidade: true, pais_origem: true,
  sexo: true, cor_raca: true, data_nascimento: true, municipio_nascimento: true, uf_nascimento: true,
  bolsa_familia: true, possui_deficiencia: true, descricao_deficiencia: true,
  nome_mae: true, escolaridade_mae: true, profissao_mae: true, nome_pai: true, escolaridade_pai: true,
  profissao_pai: true, responsavel: true, parentesco_responsavel: true, total_pessoas_casa: true,
  tipo_moradia: true, rua: true, bairro: true, cidade: true, uf: true, cep: true, telefone: true,
  escola_origem: true, cidade_escola: true, serie: true, ano_conclusao: true,
  transporte_escolar: true, pessoas_autorizadas: true, irmaos_gemeos: true,
  convenio_medico: true, hipertensao: true, diabetes: true, asma: true, tratamento_medico: true,
  restricao_medicamentos: true, medicamentos_controlados: true, restricao_alimentar: true,
};
const FIELDS = Object.keys(FIELD_MAP) as (keyof AlunoInput)[];

/** Dados resumidos usados na listagem. */
export type AlunoResumo = Pick<
  Aluno,
  'id' | 'nome' | 'nome_social' | 'data_nascimento' | 'serie' | 'bairro' | 'bolsa_familia' | 'possui_deficiencia' | 'created_at'
>;

export type StudentSort = 'nome' | 'recentes' | 'idade';

export type StudentFilters = {
  search?: string;
  serie?: string | null;
  bairro?: string | null;
  bolsaFamilia?: 0 | 1 | null;
  sort?: StudentSort;
};

const SORT_SQL: Record<StudentSort, string> = {
  nome: 'nome COLLATE NOCASE ASC',
  recentes: 'created_at DESC',
  // Data de nascimento mais recente = aluno mais novo.
  idade: 'data_nascimento DESC',
};

export function listStudents(db: SQLiteDatabase, filters: StudentFilters = {}) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  const search = filters.search?.trim();
  if (search) {
    where.push('(nome LIKE ? OR nome_social LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (filters.serie) {
    where.push('serie = ?');
    params.push(filters.serie);
  }
  if (filters.bairro) {
    where.push('bairro = ?');
    params.push(filters.bairro);
  }
  if (filters.bolsaFamilia === 0 || filters.bolsaFamilia === 1) {
    where.push('bolsa_familia = ?');
    params.push(filters.bolsaFamilia);
  }

  const sql = `
    SELECT id, nome, nome_social, data_nascimento, serie, bairro, bolsa_familia, possui_deficiencia, created_at
    FROM alunos
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${SORT_SQL[filters.sort ?? 'nome']}`;
  return db.getAllAsync<AlunoResumo>(sql, params);
}

/** Todos os alunos com todos os campos (usado pelo dashboard e pelos relatórios). */
export function listAllStudents(db: SQLiteDatabase) {
  return db.getAllAsync<Aluno>('SELECT * FROM alunos ORDER BY nome COLLATE NOCASE');
}

export function getStudent(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<AlunoDetalhado>(
    `SELECT a.*, c.nome AS created_by_nome, u.nome AS updated_by_nome
     FROM alunos a
     LEFT JOIN usuarios c ON c.id = a.created_by
     LEFT JOIN usuarios u ON u.id = a.updated_by
     WHERE a.id = ?`,
    id,
  );
}

export async function listDistinctValues(db: SQLiteDatabase, column: 'bairro' | 'serie') {
  const rows = await db.getAllAsync<{ valor: string }>(
    `SELECT DISTINCT ${column} AS valor FROM alunos WHERE ${column} IS NOT NULL AND ${column} <> '' ORDER BY ${column} COLLATE NOCASE`,
  );
  return rows.map((row) => row.valor);
}

async function assertCpfAvailable(db: SQLiteDatabase, cpf: string | null, ignoreId?: number) {
  if (!cpf) return;
  const existing = await db.getFirstAsync<{ id: number; nome: string }>(
    'SELECT id, nome FROM alunos WHERE cpf = ? AND id <> ?',
    cpf,
    ignoreId ?? -1,
  );
  if (existing) throw new DomainError(`Este CPF já está cadastrado para ${existing.nome}.`, 'cpf');
}

function rethrowUnique(error: unknown): never {
  if (isUniqueViolation(error)) throw new DomainError('Este CPF já está cadastrado para outro aluno.', 'cpf');
  throw error;
}

export async function createStudent(
  db: SQLiteDatabase,
  input: AlunoInput,
  userId: number,
  /** Data de cadastro; usado apenas pelos dados de exemplo. Padrão: agora. */
  createdAt = nowIso(),
) {
  await assertCpfAvailable(db, input.cpf);
  let id = 0;
  try {
    await db.withTransactionAsync(async () => {
      const now = createdAt;
      const columns = [...FIELDS, 'created_at', 'updated_at', 'created_by', 'updated_by'];
      const values = [...FIELDS.map((field) => input[field]), now, now, userId, userId];
      const result = await db.runAsync(
        `INSERT INTO alunos (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values,
      );
      id = result.lastInsertRowId;

      // Todo aluno começa a linha do tempo com o registro de entrada no projeto.
      await db.runAsync(
        'INSERT INTO historico (aluno_id, tipo, descricao, data_evento, usuario_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        'Entrada no projeto',
        `Aluno cadastrado na Casa São Domingos Sávio${input.serie ? ` (${input.serie})` : ''}.`,
        createdAt.slice(0, 10),
        userId,
        now,
      );
      await logAudit(db, { usuarioId: userId, acao: 'criar', entidade: 'aluno', entidadeId: id, descricao: input.nome });
    });
  } catch (error) {
    rethrowUnique(error);
  }
  return id;
}

export async function updateStudent(db: SQLiteDatabase, id: number, input: AlunoInput, userId: number) {
  const current = await db.getFirstAsync<Aluno>('SELECT * FROM alunos WHERE id = ?', id);
  if (!current) throw new DomainError('Aluno não encontrado. Ele pode ter sido excluído.');
  await assertCpfAvailable(db, input.cpf, id);

  try {
    await db.withTransactionAsync(async () => {
      const now = nowIso();
      const assignments = [...FIELDS.map((field) => `${field} = ?`), 'updated_at = ?', 'updated_by = ?'];
      const values = [...FIELDS.map((field) => input[field]), now, userId, id];
      await db.runAsync(`UPDATE alunos SET ${assignments.join(', ')} WHERE id = ?`, values);

      // Mudanças de série e de escola entram automaticamente no histórico.
      const automatic: { tipo: string; descricao: string }[] = [];
      if ((current.serie ?? '') !== (input.serie ?? '')) {
        automatic.push({
          tipo: 'Mudança de série',
          descricao: `Série alterada de "${current.serie ?? 'não informada'}" para "${input.serie ?? 'não informada'}".`,
        });
      }
      if ((current.escola_origem ?? '') !== (input.escola_origem ?? '')) {
        automatic.push({
          tipo: 'Mudança de escola',
          descricao: `Escola alterada de "${current.escola_origem ?? 'não informada'}" para "${input.escola_origem ?? 'não informada'}".`,
        });
      }
      for (const entry of automatic) {
        await db.runAsync(
          'INSERT INTO historico (aluno_id, tipo, descricao, data_evento, usuario_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          id,
          entry.tipo,
          entry.descricao,
          todayIso(),
          userId,
          now,
        );
      }
      await logAudit(db, { usuarioId: userId, acao: 'editar', entidade: 'aluno', entidadeId: id, descricao: input.nome });
    });
  } catch (error) {
    rethrowUnique(error);
  }
}

export async function deleteStudent(db: SQLiteDatabase, id: number, userId: number) {
  const current = await db.getFirstAsync<{ nome: string }>('SELECT nome FROM alunos WHERE id = ?', id);
  if (!current) throw new DomainError('Aluno não encontrado. Ele pode já ter sido excluído.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM alunos WHERE id = ?', id);
    await logAudit(db, { usuarioId: userId, acao: 'excluir', entidade: 'aluno', entidadeId: id, descricao: current.nome });
  });
}
