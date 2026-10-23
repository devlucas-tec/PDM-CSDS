import type { Aluno } from '@/database/types';
import { computeDashboard, filterStudents } from '@/lib/stats';
import { vulnerabilityLevel, vulnerabilityScore } from '@/lib/vulnerability';

const today = new Date(2026, 9, 20);

function aluno(overrides: Partial<Aluno>): Aluno {
  return {
    id: 1, nome: 'Aluno', nome_social: null, cpf: null, rg: null, nacionalidade: null, pais_origem: null, sexo: 'M',
    cor_raca: 'Parda', data_nascimento: '2016-01-01', municipio_nascimento: null, uf_nascimento: null,
    bolsa_familia: 0, possui_deficiencia: 0, descricao_deficiencia: null, nome_mae: 'Mãe', escolaridade_mae: 'Ensino médio',
    profissao_mae: null, nome_pai: null, escolaridade_pai: null, profissao_pai: null, responsavel: null,
    parentesco_responsavel: null, total_pessoas_casa: 4, tipo_moradia: 'Própria', rua: null, bairro: 'Centro',
    cidade: 'Campina Grande', uf: 'PB', cep: null, telefone: null, escola_origem: null, cidade_escola: null, serie: '3º ano',
    ano_conclusao: null, transporte_escolar: 0, pessoas_autorizadas: null, irmaos_gemeos: null, convenio_medico: null,
    hipertensao: 0, diabetes: 0, asma: 0, tratamento_medico: null, restricao_medicamentos: null, medicamentos_controlados: null,
    restricao_alimentar: null, created_at: '2025-03-01T12:00:00.000Z', updated_at: '2025-03-01T12:00:00.000Z',
    created_by: 1, updated_by: 1,
    ...overrides,
  };
}

describe('índice de vulnerabilidade', () => {
  it('soma 1 ponto por critério e classifica 0–1 baixa, 2–3 média, 4–5 alta', () => {
    const allCriteria = aluno({
      bolsa_familia: 1,
      total_pessoas_casa: 7,
      escolaridade_pai: 'Não estudou',
      tipo_moradia: 'Ocupação',
      transporte_escolar: 1,
    });
    expect(vulnerabilityScore(allCriteria)).toBe(5);
    expect(vulnerabilityScore(aluno({}))).toBe(0);
    expect([0, 1, 2, 3, 4, 5].map(vulnerabilityLevel)).toEqual(['baixa', 'baixa', 'media', 'media', 'alta', 'alta']);
  });

  it('exatamente 5 pessoas na casa não conta (precisa ser mais de cinco)', () => {
    expect(vulnerabilityScore(aluno({ total_pessoas_casa: 5 }))).toBe(0);
  });
});

describe('dashboard', () => {
  const students = [
    aluno({ id: 1, sexo: 'M', bolsa_familia: 1, total_pessoas_casa: 3, bairro: 'Malvinas', data_nascimento: '2019-05-01' }),
    aluno({ id: 2, sexo: 'F', possui_deficiencia: 1, total_pessoas_casa: 6, transporte_escolar: 1, data_nascimento: '2012-01-01' }),
    aluno({ id: 3, sexo: 'F', bolsa_familia: 1, total_pessoas_casa: 4, serie: '5º ano', created_at: '2026-02-01T12:00:00.000Z' }),
  ];

  it('calcula os indicadores principais', () => {
    const data = computeDashboard(students, null, today);
    expect(data.total).toBe(3);
    expect(data.bolsaFamilia).toEqual({ count: 2, percent: 67 });
    expect(data.deficiencia).toBe(1);
    expect(data.mediaPessoasCasa).toBe(4.3);
    expect(data.transporte).toBe(1);
    expect(data.genero).toEqual([
      { label: 'Meninos', value: 1 },
      { label: 'Meninas', value: 2 },
    ]);
    expect(data.idade.find((b) => b.label === '5–7')?.value).toBe(1);
    expect(data.idade.find((b) => b.label === '14+')?.value).toBe(1);
  });

  it('aplica os filtros de ano, série e bairro', () => {
    expect(filterStudents(students, { ano: 2025, serie: null, bairro: null })).toHaveLength(2);
    expect(filterStudents(students, { ano: null, serie: '5º ano', bairro: null })).toHaveLength(1);
    expect(filterStudents(students, { ano: null, serie: null, bairro: 'Malvinas' })).toHaveLength(1);
  });
});
