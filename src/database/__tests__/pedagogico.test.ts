/**
 * @jest-environment node
 */
import { student } from './fixtures';
import { openTestDatabase } from './node-sqlite-adapter';

import { getAttendanceList, getStudentAttendance, saveAttendance } from '@/database/attendance-repository';
import { createReport, getReport, listReports, markReportRead, registerGuardianContact } from '@/database/behavior-repository';
import { deleteClass, getClass, listClasses, planClasses, updateClass, type Actor } from '@/database/class-repository';
import { listHistory } from '@/database/history-repository';
import { MIGRATIONS, migrateDatabase } from '@/database/schema';
import { DEMO_PASSWORD, seedDemoData } from '@/database/seed';
import { createStudent } from '@/database/student-repository';
import { authenticate, createUser } from '@/database/user-repository';
import { saveWorkshop } from '@/database/workshop-repository';
import { generateDates } from '@/lib/calendar';
import { todayIso } from '@/lib/format';

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm: string, data: string) => crypto.createHash('sha256').update(data).digest('hex'),
    randomUUID: () => crypto.randomUUID(),
  };
});

async function setup() {
  const db = openTestDatabase();
  await migrateDatabase(db);
  const coordId = await createUser(db, { nome: 'Ramona', email: 'coord@casa.org', senha: 'segura123', perfil: 'coordenador' }, null);
  const profId = await createUser(db, { nome: 'Rafael', email: 'judo@casa.org', senha: 'segura123', perfil: 'professor' }, coordId);
  const outroProfId = await createUser(db, { nome: 'Clara', email: 'artes@casa.org', senha: 'segura123', perfil: 'professor' }, coordId);
  const coord: Actor = { id: coordId, perfil: 'coordenador' };
  const prof: Actor = { id: profId, perfil: 'professor' };
  const outroProf: Actor = { id: outroProfId, perfil: 'professor' };

  const ana = await createStudent(db, student(), coordId);
  const davi = await createStudent(db, student({ nome: 'Davi Souza' }), coordId);
  const oficinaId = await saveWorkshop(
    db,
    null,
    { nome: 'Judô', descricao: null, local: 'Quadra', professorIds: [profId], alunoIds: [ana, davi] },
    coordId,
  );
  return { db, coord, prof, outroProf, ana, davi, oficinaId };
}

describe('migração v1 → v2', () => {
  it('mantém os usuários e converte o perfil antigo "usuario" em coordenador', async () => {
    const db = openTestDatabase();
    await MIGRATIONS[0](db);
    await db.execAsync('PRAGMA user_version = 1');
    await db.runAsync(
      "INSERT INTO usuarios (nome, email, senha_hash, senha_salt, perfil, created_at) VALUES ('Ana', 'a@a.com', 'h', 's', 'usuario', '2026-01-01')",
    );
    await db.runAsync("INSERT INTO sessao (id, usuario_id, token, created_at) VALUES (1, 1, 't', '2026-01-01')");

    await migrateDatabase(db);

    const user = await db.getFirstAsync<{ perfil: string }>('SELECT perfil FROM usuarios WHERE id = 1');
    expect(user?.perfil).toBe('coordenador');
    expect(await db.getFirstAsync('SELECT * FROM sessao')).not.toBeNull();
    const fk = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(fk?.foreign_keys).toBe(1);
  });
});

describe('calendário', () => {
  it('gera as datas dos dias da semana escolhidos', () => {
    // Outubro de 2026: dia 5 é segunda-feira.
    expect(generateDates('2026-10-05', '2026-10-18', [1, 3])).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']);
  });

  it('planeja aulas sem duplicar datas e só para a coordenação', async () => {
    const { db, coord, prof, oficinaId } = await setup();
    const plan = { oficinaId, inicio: '2026-10-05', fim: '2026-10-18', diasSemana: [1, 3], horaInicio: '14:00', horaFim: '15:00' };
    expect(await planClasses(db, plan, coord)).toBe(4);
    expect(await planClasses(db, plan, coord)).toBe(0);
    await expect(planClasses(db, plan, prof)).rejects.toThrow(/coordenação/);
  });

  it('professor só vê as aulas das próprias oficinas', async () => {
    const { db, coord, prof, outroProf, oficinaId } = await setup();
    await planClasses(db, { oficinaId, inicio: '2026-10-05', fim: '2026-10-11', diasSemana: [1], horaInicio: '14:00', horaFim: '15:00' }, coord);
    const range = { from: '2026-10-01', to: '2026-10-31' };
    expect(await listClasses(db, { ...range, professorId: prof.id })).toHaveLength(1);
    expect(await listClasses(db, { ...range, professorId: outroProf.id })).toHaveLength(0);
  });

  it('remarcar e cancelar exigem justificativa e guardam a data original', async () => {
    const { db, coord, oficinaId } = await setup();
    await planClasses(db, { oficinaId, inicio: '2026-10-05', fim: '2026-10-05', diasSemana: [1], horaInicio: '14:00', horaFim: '15:00' }, coord);
    const [aula] = await listClasses(db, { from: '2026-10-01', to: '2026-10-31' });

    const change = { data: '2026-10-06', horaInicio: '14:00', horaFim: '15:00', cancelada: false, justificativa: '' };
    await expect(updateClass(db, aula.id, change, coord)).rejects.toThrow(/justificativa/);

    expect(await updateClass(db, aula.id, { ...change, justificativa: 'Professor em viagem' }, coord)).toBe('remarcada');
    const moved = await getClass(db, aula.id);
    expect(moved).toMatchObject({ data: '2026-10-06', data_original: '2026-10-05', justificativa: 'Professor em viagem' });

    expect(await updateClass(db, aula.id, { ...change, cancelada: true, justificativa: 'Chuva forte' }, coord)).toBe('cancelada');
  });
});

describe('chamada e relatórios', () => {
  async function pastClass() {
    const ctx = await setup();
    const today = todayIso();
    await planClasses(
      ctx.db,
      { oficinaId: ctx.oficinaId, inicio: today, fim: today, diasSemana: [0, 1, 2, 3, 4, 5, 6], horaInicio: '08:00', horaFim: '09:00' },
      ctx.coord,
    );
    const [aula] = await listClasses(ctx.db, { from: today, to: today });
    return { ...ctx, aulaId: aula.id };
  }

  it('o professor da oficina registra a chamada; outro professor não', async () => {
    const { db, prof, outroProf, ana, davi, aulaId } = await pastClass();
    const entries = [
      { alunoId: ana, presente: true },
      { alunoId: davi, presente: false },
    ];
    await expect(saveAttendance(db, aulaId, entries, outroProf)).rejects.toThrow(/não está vinculado/);
    await saveAttendance(db, aulaId, entries, prof);

    const list = await getAttendanceList(db, aulaId);
    expect(list.map((i) => [i.nome, i.presente])).toEqual([
      ['Ana Clara Santos', 1],
      ['Davi Souza', 0],
    ]);
    expect(await getStudentAttendance(db, ana)).toEqual([{ oficina_id: expect.any(Number), oficina_nome: 'Judô', total: 1, presentes: 1 }]);
  });

  it('não permite chamada de aula cancelada nem futura, e aula com chamada não pode ser excluída', async () => {
    const { db, coord, prof, ana, aulaId, oficinaId } = await pastClass();
    await saveAttendance(db, aulaId, [{ alunoId: ana, presente: true }], prof);
    await expect(deleteClass(db, aulaId, coord)).rejects.toThrow(/chamada registrada/);

    await planClasses(db, { oficinaId, inicio: '2099-01-05', fim: '2099-01-05', diasSemana: [1], horaInicio: '08:00', horaFim: '09:00' }, coord);
    const [future] = await listClasses(db, { from: '2099-01-01', to: '2099-01-31' });
    await expect(saveAttendance(db, future.id, [{ alunoId: ana, presente: true }], prof)).rejects.toThrow(/no dia da aula/);
  });

  it('relatório do professor chega à coordenação e o contato vai para o histórico do aluno', async () => {
    const { db, coord, prof, ana, aulaId } = await pastClass();
    const id = await createReport(db, { alunoId: ana, aulaId, texto: 'Ficou agitada e não quis participar da atividade.' }, prof);

    expect(await listReports(db, { status: 'novo' })).toHaveLength(1);
    await markReportRead(db, id, coord);
    expect((await getReport(db, id))?.status).toBe('lido');

    await registerGuardianContact(db, id, 'Liguei para a mãe; ela relatou problemas de sono.', coord);
    expect((await getReport(db, id))?.status).toBe('contato_realizado');
    expect((await listHistory(db, ana)).map((h) => h.tipo)).toContain('Acompanhamento social');

    await expect(db.runAsync("UPDATE relatorios_comportamento SET texto = 'outro' WHERE id = ?", id)).rejects.toThrow(/não pode ser alterado/);
    await expect(markReportRead(db, id, prof)).rejects.toThrow(/coordenação/);
  });
});

describe('perfis', () => {
  it('professor e coordenador entram com email e senha', async () => {
    const { db } = await setup();
    expect((await authenticate(db, 'judo@casa.org', 'segura123'))?.perfil).toBe('professor');
    expect((await authenticate(db, 'coord@casa.org', 'segura123'))?.perfil).toBe('coordenador');
  });
});

describe('dados de demonstração', () => {
  it('geram equipe, oficinas, calendário, chamadas e relatórios, e podem rodar duas vezes', async () => {
    const db = openTestDatabase();
    await migrateDatabase(db);
    const adminId = await createUser(db, { nome: 'Admin', email: 'admin@casa.org', senha: 'segura123', perfil: 'admin' }, null);
    const admin: Actor = { id: adminId, perfil: 'admin' };

    const first = await seedDemoData(db, admin, 20);
    expect(first.alunos).toBeGreaterThan(15);
    expect(first.aulas).toBeGreaterThan(300);
    expect(first.presencas).toBeGreaterThan(0);

    const second = await seedDemoData(db, admin, 5);
    expect(second.aulas).toBe(0); // calendário não é duplicado

    const count = async (sql: string) => (await db.getFirstAsync<{ n: number }>(sql))?.n ?? 0;
    expect(await count("SELECT COUNT(*) AS n FROM usuarios WHERE perfil = 'professor'")).toBe(5);
    expect(await count('SELECT COUNT(*) AS n FROM oficinas')).toBe(9);
    expect(await count("SELECT COUNT(*) AS n FROM aulas WHERE status <> 'agendada' AND justificativa IS NULL")).toBe(0);
    expect((await authenticate(db, 'judo@casa.org', DEMO_PASSWORD))?.perfil).toBe('professor');
  });
});
