import type { AlunoInput } from '@/database/types';

/** Aluno válido para os testes; sobrescreva só os campos que interessam. */
export function student(overrides: Partial<AlunoInput> = {}): AlunoInput {
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
