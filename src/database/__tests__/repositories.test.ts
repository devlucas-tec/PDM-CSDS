/**
 * @jest-environment node
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { addUser } from './fixtures';
import { openTestDatabase } from './node-sqlite-adapter';

import { addHistory, listHistory } from '@/database/history-repository';
import { LATEST_VERSION, migrateDatabase } from '@/database/schema';
import { createStudent, deleteStudent, getStudent, listStudents, updateStudent } from '@/database/student-repository';
import type { AlunoInput } from '@/database/types';
import { listQueue } from '@/sync/outbox';

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm: string, data: string) => crypto.createHash('sha256').update(data).digest('hex'),
    randomUUID: () => crypto.randomUUID(),
  };
});

function student(overrides: Partial<AlunoInput> = {}): AlunoInput {
  return {
    nome: 'Ana Clara Santos', nome_social: null, cpf: null, rg: null, nacionalidade: 'Brasileira', pais_origem: 'Brasil',
    sexo: 'F', cor_raca: 'Parda', data_nascimento: '2016-03-10', municipio_nascimento: 'Campina Grande', uf_nascimento: 'PB',
    bolsa_familia: 1, possui_deficiencia: 0, descricao_deficiencia: null,
    nome_mae: 'Maria Santos', escolaridade_mae: 'Fundamental incompleto', profissao_mae: 'Doméstica',
    nome_pai: null, escolaridade_pai: null, profissao_pai: null, responsavel: null, parentesco_responsavel: 'Mãe',
    total_pessoas_casa: 6, tipo_moradia: 'Alugada', rua: 'Rua A, 10', bairro: 'Malvinas', cidade: 'Campina Grande', uf: 'PB',
    cep: '58400-000', telefone: '(83) 99999-0000', escola_origem: 'E.M. Lions Clube', cidade_escola: 'Campina Grande',
    serie: '3º ano', ano_conclusao: null, transporte_escolar: 0, pessoas_autorizadas: null, irmaos_gemeos: null,
    convenio_medico: null, hipertensao: 0, diabetes: 0, asma: 1, tratamento_medico: null, restricao_medicamentos: null,
    medicamentos_controlados: null, restricao_alimentar: 'Nenhuma',
    ...overrides,
  };
}

async function setup() {
  const db = openTestDatabase();
  await migrateDatabase(db);
  const adminId = await addUser(db, { nome: 'Ramona', email: 'ramona@casa.org', perfil: 'admin' });
  return { db, adminId };
}

describe('migrações', () => {
  it('podem rodar várias vezes sem erro (idempotentes)', async () => {
    const db = openTestDatabase();
    await migrateDatabase(db);
    await migrateDatabase(db);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(LATEST_VERSION);
  });
});

describe('fila de sincronização (offline first)', () => {
  it('cada gravação local entra na fila, na ordem em que aconteceu', async () => {
    const { db, adminId } = await setup();
    const id = await createStudent(db, student(), adminId);
    await updateStudent(db, id, student({ serie: '4º ano' }), adminId);
    await deleteStudent(db, id, adminId);

    const fila = (await listQueue(db)).map((item) => `${item.operacao} ${item.tabela}`);
    expect(fila).toEqual([
      'salvar alunos',
      'inserir historico',
      'inserir auditoria',
      'salvar alunos',
      'inserir historico', // mudança de série
      'inserir auditoria',
      'excluir alunos',
      'inserir auditoria',
    ]);
  });

  it('guarda uma cópia do registro no momento da alteração', async () => {
    const { db, adminId } = await setup();
    const id = await createStudent(db, student({ nome: 'Primeiro nome' }), adminId);
    await updateStudent(db, id, student({ nome: 'Nome corrigido' }), adminId);
    const salvos = (await listQueue(db)).filter((item) => item.tabela === 'alunos').map((item) => JSON.parse(item.dados!).nome);
    expect(salvos).toEqual(['Primeiro nome', 'Nome corrigido']);
  });

  it('se a gravação falha, nada entra na fila (mesma transação)', async () => {
    const { db, adminId } = await setup();
    await expect(createStudent(db, student({ bolsa_familia: 2 as 0 }), adminId)).rejects.toThrow();
    expect(await listQueue(db)).toHaveLength(0);
  });
});

describe('CRUD de alunos', () => {
  it('cadastra, lista, edita e exclui', async () => {
    const { db, adminId } = await setup();
    const id = await createStudent(db, student(), adminId);

    expect(await listStudents(db)).toHaveLength(1);

    await updateStudent(db, id, student({ nome: 'Ana Clara S. Lima', serie: '4º ano' }), adminId);
    const updated = await getStudent(db, id);
    expect(updated?.nome).toBe('Ana Clara S. Lima');
    expect(updated?.updated_by_nome).toBe('Ramona');

    await deleteStudent(db, id, adminId);
    expect(await getStudent(db, id)).toBeNull();
    expect(await listHistory(db, id)).toHaveLength(0);
    const audit = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM auditoria WHERE acao = 'excluir'");
    expect(audit?.total).toBe(1);
  });

  it('filtra por nome, série, bairro e Bolsa Família', async () => {
    const { db, adminId } = await setup();
    await createStudent(db, student({ nome: 'Davi Souza', bairro: 'Catolé', bolsa_familia: 0, serie: '5º ano' }), adminId);
    await createStudent(db, student({ nome: 'Laura Lima' }), adminId);

    expect((await listStudents(db, { search: 'davi' })).map((s) => s.nome)).toEqual(['Davi Souza']);
    expect(await listStudents(db, { bairro: 'Malvinas' })).toHaveLength(1);
    expect(await listStudents(db, { serie: '5º ano' })).toHaveLength(1);
    expect((await listStudents(db, { bolsaFamilia: 1 })).map((s) => s.nome)).toEqual(['Laura Lima']);
  });

  it('não aceita CPF repetido', async () => {
    const { db, adminId } = await setup();
    await createStudent(db, student({ cpf: '529.982.247-25' }), adminId);
    await expect(createStudent(db, student({ nome: 'Outro', cpf: '529.982.247-25' }), adminId)).rejects.toThrow(/CPF já está cadastrado/);
  });

  it('o banco recusa valores booleanos diferentes de 0 e 1', async () => {
    const { db, adminId } = await setup();
    await expect(createStudent(db, student({ bolsa_familia: 2 as 0 }), adminId)).rejects.toThrow(/CHECK constraint/);
  });
});

describe('histórico do aluno', () => {
  it('cria a entrada no projeto e registra mudança de série automaticamente', async () => {
    const { db, adminId } = await setup();
    const id = await createStudent(db, student(), adminId);
    await updateStudent(db, id, student({ serie: '4º ano' }), adminId);

    const tipos = (await listHistory(db, id)).map((h) => h.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['Entrada no projeto', 'Mudança de série']));
  });

  it('lista do mais recente para o mais antigo, com o usuário responsável', async () => {
    const { db, adminId } = await setup();
    const id = await createStudent(db, student(), adminId, '2025-01-05T10:00:00.000Z');
    await addHistory(db, id, { tipo: 'Acompanhamento social', descricao: 'Visita à família', data_evento: '2025-06-01' }, adminId);
    await addHistory(db, id, { tipo: 'Ocorrência relevante', descricao: 'Primeira apresentação', data_evento: '2025-09-15' }, adminId);

    const history = await listHistory(db, id);
    expect(history.map((h) => h.data_evento)).toEqual(['2025-09-15', '2025-06-01', '2025-01-05']);
    expect(history[0].usuario_nome).toBe('Ramona');
  });

  it('não permite alterar um registro já salvo', async () => {
    const { db, adminId } = await setup();
    const id = await createStudent(db, student(), adminId);
    await expect(db.runAsync("UPDATE historico SET descricao = 'alterado' WHERE aluno_id = ?", id)).rejects.toThrow(
      /não podem ser alterados/,
    );
  });
});

describe('persistência', () => {
  it('os dados e a fila continuam no arquivo depois de fechar e reabrir o banco', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'csds-'));
    const file = join(dir, 'teste.db');
    try {
      const first = openTestDatabase(file);
      await migrateDatabase(first);
      const userId = await addUser(first, { nome: 'Ramona', email: 'r@casa.org', perfil: 'admin' });
      await createStudent(first, student(), userId);
      first.close();

      const reopened = openTestDatabase(file);
      await migrateDatabase(reopened);
      expect(await listStudents(reopened)).toHaveLength(1);
      // A fila também sobrevive ao fechamento do app: nada se perde sem internet.
      expect((await listQueue(reopened)).length).toBeGreaterThan(0);
      reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
