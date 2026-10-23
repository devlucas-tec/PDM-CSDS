import type { SQLiteDatabase } from 'expo-sqlite';

import { CORES_RACA, ESCOLARIDADES, RESTRICOES_ALIMENTARES, SERIES, TIPOS_MORADIA } from '@/constants/options';
import { createReport, markReportRead, registerGuardianContact } from '@/database/behavior-repository';
import { planClasses, updateClass, type Actor } from '@/database/class-repository';
import { createStudent } from '@/database/student-repository';
import type { AlunoInput, Perfil, SimNao } from '@/database/types';
import { createUser } from '@/database/user-repository';
import { getWorkshop, saveWorkshop } from '@/database/workshop-repository';
import { nowIso, todayIso } from '@/lib/format';

/**
 * Dados fictícios para demonstração (vídeo e apresentação). Nenhum dado real
 * de criança é usado. Os valores são sorteados por um gerador simples com
 * semente, para que nomes, bairros e condições variem de forma plausível.
 */

const FIRST_NAMES_M = ['Arthur', 'Davi', 'Gabriel', 'Heitor', 'Miguel', 'Pedro', 'Samuel', 'Lucas', 'Benjamin', 'Theo', 'João', 'Enzo'];
const FIRST_NAMES_F = ['Alice', 'Helena', 'Laura', 'Maria Clara', 'Valentina', 'Cecília', 'Lívia', 'Sophia', 'Manuela', 'Ana Júlia', 'Isabela', 'Lara'];
const SURNAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Araújo'];
const MOTHERS = ['Ana', 'Francisca', 'Antônia', 'Adriana', 'Juliana', 'Márcia', 'Fernanda', 'Patrícia', 'Aline', 'Sandra'];
const FATHERS = ['José', 'Antônio', 'Francisco', 'Carlos', 'Paulo', 'Marcos', 'Luiz', 'Rafael', 'Daniel', 'Marcelo'];
const BAIRROS = ['Malvinas', 'Bodocongó', 'Catolé', 'Liberdade', 'José Pinheiro', 'Centro', 'Pedregal', 'Jeremias'];
const ESCOLAS = ['E.M. Padre Antonino', 'E.E. Severino Cabral', 'E.M. Lions Clube', 'E.E. Elpídio de Almeida', 'E.M. Anésio Leão'];
const PROFISSOES_M = ['Doméstica', 'Diarista', 'Autônoma', 'Desempregada', 'Cozinheira', 'Costureira', 'Vendedora'];
const PROFISSOES_P = ['Pedreiro', 'Autônomo', 'Desempregado', 'Motorista', 'Servente', 'Agricultor', 'Vigilante'];

function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    // Gerador linear congruente simples (determinístico).
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (probability: number): SimNao => (next() < probability ? 1 : 0),
  };
}

function generateCpf(random: { int: (min: number, max: number) => number }) {
  const digits = Array.from({ length: 9 }, () => random.int(0, 9));
  const check = (base: number[]) => {
    const sum = base.reduce((total, digit, index) => total + digit * (base.length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  digits.push(check(digits));
  digits.push(check(digits));
  const s = digits.join('');
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

type Random = ReturnType<typeof createRandom>;

/** Cadastra alunos fictícios e devolve os ids com a data de cadastro de cada um. */
async function seedStudents(db: SQLiteDatabase, userId: number, random: Random, count: number) {
  const currentYear = new Date().getFullYear();
  const created: { id: number; createdAt: string }[] = [];

  for (let i = 0; i < count; i++) {
    const sexo = random.chance(0.5) ? 'M' : 'F';
    const first = sexo === 'M' ? random.pick(FIRST_NAMES_M) : random.pick(FIRST_NAMES_F);
    const surname = `${random.pick(SURNAMES)} ${random.pick(SURNAMES)}`;
    const age = random.int(7, 15);
    const birth = `${currentYear - age}-${String(random.int(1, 12)).padStart(2, '0')}-${String(random.int(1, 28)).padStart(2, '0')}`;
    const serieIndex = Math.min(Math.max(age - 6, 0), SERIES.length - 1);
    const hasDisability = random.chance(0.08);
    const pessoas = random.int(2, 9);

    const input: AlunoInput = {
      nome: `${first} ${surname}`,
      nome_social: null,
      cpf: random.chance(0.7) ? generateCpf(random) : null,
      rg: random.chance(0.5) ? String(random.int(1000000, 9999999)) : null,
      nacionalidade: 'Brasileira',
      pais_origem: 'Brasil',
      sexo,
      cor_raca: random.pick(['Parda', 'Parda', 'Parda', 'Preta', 'Branca', ...CORES_RACA]),
      data_nascimento: birth,
      municipio_nascimento: 'Campina Grande',
      uf_nascimento: 'PB',
      bolsa_familia: random.chance(0.6),
      possui_deficiencia: hasDisability,
      descricao_deficiencia: hasDisability ? random.pick(['TEA (autismo)', 'Deficiência auditiva', 'TDAH', 'Deficiência visual leve']) : null,
      nome_mae: `${random.pick(MOTHERS)} ${surname.split(' ')[0]}`,
      escolaridade_mae: random.pick(ESCOLARIDADES),
      profissao_mae: random.pick(PROFISSOES_M),
      nome_pai: random.chance(0.75) ? `${random.pick(FATHERS)} ${surname.split(' ')[1]}` : null,
      escolaridade_pai: random.chance(0.75) ? random.pick(ESCOLARIDADES) : null,
      profissao_pai: random.chance(0.7) ? random.pick(PROFISSOES_P) : null,
      responsavel: null,
      parentesco_responsavel: 'Mãe',
      total_pessoas_casa: pessoas,
      tipo_moradia: random.pick(['Própria', 'Alugada', 'Alugada', ...TIPOS_MORADIA]),
      rua: `Rua ${random.pick(['das Flores', 'São José', 'Projetada', 'João Pessoa', 'Sete de Setembro'])}, ${random.int(10, 999)}`,
      bairro: random.pick(BAIRROS),
      cidade: 'Campina Grande',
      uf: 'PB',
      cep: `58${random.int(100, 499)}-${String(random.int(0, 999)).padStart(3, '0')}`,
      telefone: `(83) 9${random.int(8000, 9999)}-${random.int(1000, 9999)}`,
      escola_origem: random.pick(ESCOLAS),
      cidade_escola: 'Campina Grande',
      serie: SERIES[serieIndex],
      ano_conclusao: null,
      transporte_escolar: random.chance(0.3),
      pessoas_autorizadas: `${random.pick(MOTHERS)} (avó), ${random.pick(FATHERS)} (tio)`,
      irmaos_gemeos: random.chance(0.2) ? 'Possui irmão também atendido pela Casa' : null,
      convenio_medico: random.chance(0.1) ? 'Unimed' : null,
      hipertensao: random.chance(0.03),
      diabetes: random.chance(0.04),
      asma: random.chance(0.15),
      tratamento_medico: null,
      restricao_medicamentos: random.chance(0.05) ? 'Dipirona' : null,
      medicamentos_controlados: null,
      restricao_alimentar: random.chance(0.25) ? random.pick(RESTRICOES_ALIMENTARES.slice(1, 4)) : 'Nenhuma',
    };

    // Espalha as datas de cadastro entre 2024 e hoje para o filtro de ano do dashboard.
    const year = random.int(2024, currentYear);
    const month = year === currentYear ? random.int(1, new Date().getMonth() + 1) : random.int(1, 12);
    const createdAt = `${year}-${String(month).padStart(2, '0')}-${String(random.int(1, 28)).padStart(2, '0')}T12:00:00.000Z`;
    try {
      created.push({ id: await createStudent(db, input, userId, createdAt), createdAt: createdAt.slice(0, 10) });
    } catch {
      // CPF sorteado repetido: apenas pula este aluno.
    }
  }
  return created;
}

// ---------- Equipe, oficinas, calendário, chamadas e relatórios ----------

/** Senha de todas as contas de demonstração. */
export const DEMO_PASSWORD = 'casa1234';

export const DEMO_STAFF: { nome: string; email: string; perfil: Perfil; telefone: string }[] = [
  { nome: 'Fernanda Rocha', email: 'coordenacao@casa.org', perfil: 'coordenador', telefone: '(83) 99101-2020' },
  { nome: 'Rafael Costa', email: 'judo@casa.org', perfil: 'professor', telefone: '(83) 99202-3030' },
  { nome: 'Clara Souza', email: 'artes@casa.org', perfil: 'professor', telefone: '(83) 99303-4040' },
  { nome: 'Lucas Mendes', email: 'musica@casa.org', perfil: 'professor', telefone: '(83) 99404-5050' },
  { nome: 'Júlia Alves', email: 'danca@casa.org', perfil: 'professor', telefone: '(83) 99505-6060' },
  { nome: 'Marta Lima', email: 'reforco@casa.org', perfil: 'professor', telefone: '(83) 99606-7070' },
];

/** Oficinas da Casa (minuta), com professor, local e horário semanal. */
const DEMO_WORKSHOPS = [
  { nome: 'Judô', local: 'Quadra', professor: 'judo@casa.org', dias: [1, 3], inicio: '14:00', fim: '15:00' },
  { nome: 'Educação Física', local: 'Quadra', professor: 'judo@casa.org', dias: [2, 4], inicio: '08:00', fim: '09:00' },
  { nome: 'Artes', local: 'Ateliê', professor: 'artes@casa.org', dias: [2, 4], inicio: '14:00', fim: '15:30' },
  { nome: 'Música', local: 'Sala 2', professor: 'musica@casa.org', dias: [1, 3], inicio: '15:30', fim: '16:30' },
  { nome: 'Informática', local: 'Laboratório', professor: 'musica@casa.org', dias: [5], inicio: '09:00', fim: '10:30' },
  { nome: 'Balé', local: 'Sala de dança', professor: 'danca@casa.org', dias: [2, 4], inicio: '09:00', fim: '10:00' },
  { nome: 'Dança', local: 'Sala de dança', professor: 'danca@casa.org', dias: [5], inicio: '14:00', fim: '15:00' },
  { nome: 'Reforço escolar', local: 'Sala 1', professor: 'reforco@casa.org', dias: [1, 3], inicio: '08:00', fim: '09:30' },
  { nome: 'Evangelização', local: 'Capela', professor: 'reforco@casa.org', dias: [5], inicio: '15:30', fim: '16:30' },
];

const CANCEL_REASONS = [
  'Professor avisou que estará em consulta médica.',
  'Feriado municipal.',
  'Falta de energia na Casa.',
  'Professor participará de formação da prefeitura.',
];

const RESCHEDULE_REASONS = [
  'Professor pediu para trocar o dia por compromisso pessoal.',
  'Espaço ocupado pela reunião de pais; aula transferida.',
];

const REPORTS_CONCERN = [
  'Chegou muito quieto e chorou no início da aula. Disse que não dormiu bem. Vale acompanhar.',
  'Teve um conflito com um colega e precisou ser separado. Depois se acalmou e participou.',
  'Está faltando com frequência e, quando vem, parece cansado e com fome antes do lanche.',
  'Comentou que está sozinho em casa à noite. Sugiro contato com a família.',
  'Ficou muito agitado, não conseguiu acompanhar as instruções e saiu da sala duas vezes.',
];

const REPORTS_POSITIVE = [
  'Excelente participação! Ajudou os colegas mais novos e mostrou liderança.',
  'Evoluiu muito na coordenação motora; está mais confiante nas atividades.',
  'Muito dedicado, chegou cedo e ajudou a organizar o material.',
  'Apresentou o trabalho para a turma com segurança. Grande progresso.',
];

const CONTACT_NOTES = [
  'Liguei para a mãe; ela relatou mudança de rotina em casa. Combinamos acompanhar nas próximas semanas.',
  'Conversei com a avó, que é a responsável. Encaminhado para a assistente social.',
  'Mãe veio à Casa; está ciente e vai reforçar o horário de sono.',
];

async function ensureStaff(db: SQLiteDatabase, createdBy: number) {
  const ids = new Map<string, number>();
  for (const person of DEMO_STAFF) {
    const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM usuarios WHERE email = ?', person.email);
    const id = existing?.id ?? (await createUser(db, { ...person, senha: DEMO_PASSWORD }, createdBy));
    ids.set(person.email, id);
  }
  return ids;
}

/** Insere linhas em lotes (um INSERT com vários VALUES), bem mais rápido que uma a uma. */
async function insertBatch(db: SQLiteDatabase, sqlPrefix: string, columns: number, rows: (string | number | null)[][]) {
  const chunk = 150;
  const placeholders = `(${Array.from({ length: columns }, () => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    await db.runAsync(`${sqlPrefix} VALUES ${slice.map(() => placeholders).join(', ')}`, slice.flat());
  }
}

function nextDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export type DemoSummary = { alunos: number; aulas: number; presencas: number; relatorios: number };

/**
 * Gera um ano letivo de demonstração: alunos, equipe (coordenação e
 * professores), oficinas com matrículas, calendário de fevereiro a dezembro,
 * remarcações e cancelamentos com justificativa, chamadas das aulas que já
 * aconteceram e relatórios de comportamento em vários estágios.
 */
export async function seedDemoData(db: SQLiteDatabase, admin: Actor, studentCount = 40): Promise<DemoSummary> {
  const random = createRandom(Date.now() % 100000);
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const coordActor: Actor = { id: admin.id, perfil: 'coordenador' };

  const students = await seedStudents(db, admin.id, random, studentCount);
  const staff = await ensureStaff(db, admin.id);

  // Matrícula dos novos alunos: 2 ou 3 oficinas cada (metade no reforço escolar).
  const enrollment = new Map<string, number[]>(DEMO_WORKSHOPS.map((w) => [w.nome, []]));
  for (const s of students) {
    const target = random.int(2, 3);
    const picks = new Set<string>();
    if (random.chance(0.5)) picks.add('Reforço escolar');
    while (picks.size < target) picks.add(random.pick(DEMO_WORKSHOPS).nome);
    for (const nome of picks) enrollment.get(nome)?.push(s.id);
  }

  let aulasCriadas = 0;
  const workshopByName = new Map<string, number>();
  const professorByWorkshop = new Map<number, number>();
  for (const w of DEMO_WORKSHOPS) {
    const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM oficinas WHERE nome = ?', w.nome);
    const current = existing ? await getWorkshop(db, existing.id) : null;
    const professorId = staff.get(w.professor)!;
    const id = await saveWorkshop(
      db,
      existing?.id ?? null,
      {
        nome: w.nome,
        descricao: current?.oficina.descricao ?? null,
        local: current?.oficina.local ?? w.local,
        professorIds: [...(current?.professorIds ?? []), professorId],
        alunoIds: [...(current?.alunoIds ?? []), ...(enrollment.get(w.nome) ?? [])],
      },
      admin.id,
    );
    workshopByName.set(w.nome, id);
    professorByWorkshop.set(id, professorId);

    // Calendário anual só para oficinas que ainda não têm aulas.
    const hasClasses = await db.getFirstAsync('SELECT 1 FROM aulas WHERE oficina_id = ?', id);
    if (!hasClasses) {
      aulasCriadas += await planClasses(
        db,
        { oficinaId: id, inicio: `${year}-02-02`, fim: `${year}-12-11`, diasSemana: w.dias, horaInicio: w.inicio, horaFim: w.fim },
        coordActor,
      );
    }
  }

  // Cancelamentos passados e mudanças futuras, sempre com justificativa.
  type Slot = { id: number; data: string; hora_inicio: string; hora_fim: string };
  const past = await db.getAllAsync<Slot>(
    `SELECT id, data, hora_inicio, hora_fim FROM aulas WHERE status = 'agendada' AND data < ?
       AND NOT EXISTS (SELECT 1 FROM presencas p WHERE p.aula_id = aulas.id) ORDER BY RANDOM() LIMIT 4`,
    today,
  );
  for (const aula of past) {
    const change = { data: aula.data, horaInicio: aula.hora_inicio, horaFim: aula.hora_fim, cancelada: true, justificativa: random.pick(CANCEL_REASONS) };
    await updateClass(db, aula.id, change, coordActor);
  }
  const future = await db.getAllAsync<Slot>(
    "SELECT id, data, hora_inicio, hora_fim FROM aulas WHERE status = 'agendada' AND data > ? ORDER BY data LIMIT 3 OFFSET 2",
    today,
  );
  for (const [index, aula] of future.entries()) {
    const cancel = index === 0;
    await updateClass(
      db,
      aula.id,
      {
        data: cancel ? aula.data : nextDay(aula.data),
        horaInicio: aula.hora_inicio,
        horaFim: aula.hora_fim,
        cancelada: cancel,
        justificativa: cancel ? CANCEL_REASONS[0] : random.pick(RESCHEDULE_REASONS),
      },
      coordActor,
    );
  }

  // Chamadas de todas as aulas que já aconteceram (dos alunos novos). Alguns
  // alunos faltam bem mais, para aparecerem como alerta de frequência.
  const enrolledByWorkshop = new Map<number, number[]>();
  for (const [nome, ids] of enrollment) enrolledByWorkshop.set(workshopByName.get(nome)!, ids);
  const createdAt = new Map(students.map((s) => [s.id, s.createdAt]));
  const frequentAbsent = new Set(students.filter(() => random.chance(0.15)).map((s) => s.id));
  const pastClasses = await db.getAllAsync<{ id: number; data: string; oficina_id: number }>(
    "SELECT id, data, oficina_id FROM aulas WHERE status <> 'cancelada' AND data <= ? ORDER BY data",
    today,
  );

  const now = nowIso();
  const presenceRows: (string | number | null)[][] = [];
  const attended: { aulaId: number; alunoId: number; data: string; oficinaId: number }[] = [];
  for (const aula of pastClasses) {
    for (const alunoId of enrolledByWorkshop.get(aula.oficina_id) ?? []) {
      if (aula.data < (createdAt.get(alunoId) ?? '')) continue;
      const presente = random.chance(frequentAbsent.has(alunoId) ? 0.45 : 0.88);
      presenceRows.push([aula.id, alunoId, presente, professorByWorkshop.get(aula.oficina_id) ?? null, now]);
      if (presente) attended.push({ aulaId: aula.id, alunoId, data: aula.data, oficinaId: aula.oficina_id });
    }
  }
  await db.withTransactionAsync(async () => {
    await insertBatch(db, 'INSERT OR IGNORE INTO presencas (aula_id, aluno_id, presente, registrado_por, updated_at)', 5, presenceRows);
  });

  // Relatórios de comportamento: preocupações (mais para quem falta muito) e elogios.
  const chosen = attended.filter(() => random.chance(0.012)).slice(-18);
  let relatorios = 0;
  for (const [index, item] of chosen.entries()) {
    const concern = frequentAbsent.has(item.alunoId) || index % 3 !== 0;
    const professor: Actor = { id: professorByWorkshop.get(item.oficinaId)!, perfil: 'professor' };
    const id = await createReport(
      db,
      { alunoId: item.alunoId, aulaId: item.aulaId, texto: random.pick(concern ? REPORTS_CONCERN : REPORTS_POSITIVE) },
      professor,
      `${item.data}T18:00:00.000Z`,
    );
    relatorios++;
    // Os mais antigos já foram tratados pela coordenação; os recentes ficam como "novo".
    if (index < chosen.length - 6) {
      await markReportRead(db, id, coordActor);
      if (concern && index % 2 === 0) await registerGuardianContact(db, id, random.pick(CONTACT_NOTES), coordActor);
    }
  }

  return { alunos: students.length, aulas: aulasCriadas, presencas: presenceRows.length, relatorios };
}
