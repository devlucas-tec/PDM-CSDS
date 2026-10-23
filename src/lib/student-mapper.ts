import type { Aluno, AlunoInput, Sexo, SimNao } from '@/database/types';
import { brToIso, emptyToNull, isoToBr } from '@/lib/format';
import type { StudentFormValues } from '@/lib/validation';

const bool = (value: boolean): SimNao => (value ? 1 : 0);

export const EMPTY_STUDENT_FORM: StudentFormValues = {
  nome: '', nome_social: '', cpf: '', rg: '', nacionalidade: 'Brasileira', pais_origem: 'Brasil',
  sexo: '', cor_raca: '', data_nascimento: '', municipio_nascimento: '', uf_nascimento: '',
  bolsa_familia: false, possui_deficiencia: false, descricao_deficiencia: '',
  nome_mae: '', escolaridade_mae: '', profissao_mae: '', nome_pai: '', escolaridade_pai: '', profissao_pai: '',
  responsavel: '', parentesco_responsavel: '', total_pessoas_casa: '', tipo_moradia: '',
  rua: '', bairro: '', cidade: '', uf: '', cep: '', telefone: '',
  escola_origem: '', cidade_escola: '', serie: '', ano_conclusao: '',
  transporte_escolar: false, pessoas_autorizadas: '', irmaos_gemeos: '',
  convenio_medico: '', hipertensao: false, diabetes: false, asma: false,
  tratamento_medico: '', restricao_medicamentos: '', medicamentos_controlados: '', restricao_alimentar: '',
};

/** Converte os valores digitados (já validados) no formato gravado no banco. */
export function formToStudentInput(values: StudentFormValues): AlunoInput {
  const text = emptyToNull;
  const int = (value: string) => (value.trim() ? Number(value) : null);
  return {
    nome: values.nome.trim().replace(/\s+/g, ' '),
    nome_social: text(values.nome_social),
    cpf: text(values.cpf),
    rg: text(values.rg),
    nacionalidade: text(values.nacionalidade),
    pais_origem: text(values.pais_origem),
    sexo: values.sexo === 'M' || values.sexo === 'F' ? (values.sexo as Sexo) : null,
    cor_raca: text(values.cor_raca),
    data_nascimento: brToIso(values.data_nascimento) ?? '',
    municipio_nascimento: text(values.municipio_nascimento),
    uf_nascimento: text(values.uf_nascimento),
    bolsa_familia: bool(values.bolsa_familia),
    possui_deficiencia: bool(values.possui_deficiencia),
    descricao_deficiencia: values.possui_deficiencia ? text(values.descricao_deficiencia) : null,
    nome_mae: values.nome_mae.trim().replace(/\s+/g, ' '),
    escolaridade_mae: text(values.escolaridade_mae),
    profissao_mae: text(values.profissao_mae),
    nome_pai: text(values.nome_pai),
    escolaridade_pai: text(values.escolaridade_pai),
    profissao_pai: text(values.profissao_pai),
    responsavel: text(values.responsavel),
    parentesco_responsavel: text(values.parentesco_responsavel),
    total_pessoas_casa: int(values.total_pessoas_casa),
    tipo_moradia: text(values.tipo_moradia),
    rua: text(values.rua),
    bairro: values.bairro.trim().replace(/\s+/g, ' '),
    cidade: values.cidade.trim().replace(/\s+/g, ' '),
    uf: text(values.uf),
    cep: text(values.cep),
    telefone: text(values.telefone),
    escola_origem: text(values.escola_origem),
    cidade_escola: text(values.cidade_escola),
    serie: text(values.serie),
    ano_conclusao: int(values.ano_conclusao),
    transporte_escolar: bool(values.transporte_escolar),
    pessoas_autorizadas: text(values.pessoas_autorizadas),
    irmaos_gemeos: text(values.irmaos_gemeos),
    convenio_medico: text(values.convenio_medico),
    hipertensao: bool(values.hipertensao),
    diabetes: bool(values.diabetes),
    asma: bool(values.asma),
    tratamento_medico: text(values.tratamento_medico),
    restricao_medicamentos: text(values.restricao_medicamentos),
    medicamentos_controlados: text(values.medicamentos_controlados),
    restricao_alimentar: text(values.restricao_alimentar),
  };
}

/** Carrega um aluno do banco no formulário de edição. */
export function studentToForm(aluno: Aluno): StudentFormValues {
  const text = (value: string | null) => value ?? '';
  const num = (value: number | null) => (value === null || value === undefined ? '' : String(value));
  return {
    nome: aluno.nome,
    nome_social: text(aluno.nome_social),
    cpf: text(aluno.cpf),
    rg: text(aluno.rg),
    nacionalidade: text(aluno.nacionalidade),
    pais_origem: text(aluno.pais_origem),
    sexo: text(aluno.sexo),
    cor_raca: text(aluno.cor_raca),
    data_nascimento: isoToBr(aluno.data_nascimento),
    municipio_nascimento: text(aluno.municipio_nascimento),
    uf_nascimento: text(aluno.uf_nascimento),
    bolsa_familia: aluno.bolsa_familia === 1,
    possui_deficiencia: aluno.possui_deficiencia === 1,
    descricao_deficiencia: text(aluno.descricao_deficiencia),
    nome_mae: aluno.nome_mae,
    escolaridade_mae: text(aluno.escolaridade_mae),
    profissao_mae: text(aluno.profissao_mae),
    nome_pai: text(aluno.nome_pai),
    escolaridade_pai: text(aluno.escolaridade_pai),
    profissao_pai: text(aluno.profissao_pai),
    responsavel: text(aluno.responsavel),
    parentesco_responsavel: text(aluno.parentesco_responsavel),
    total_pessoas_casa: num(aluno.total_pessoas_casa),
    tipo_moradia: text(aluno.tipo_moradia),
    rua: text(aluno.rua),
    bairro: aluno.bairro,
    cidade: aluno.cidade,
    uf: text(aluno.uf),
    cep: text(aluno.cep),
    telefone: text(aluno.telefone),
    escola_origem: text(aluno.escola_origem),
    cidade_escola: text(aluno.cidade_escola),
    serie: text(aluno.serie),
    ano_conclusao: num(aluno.ano_conclusao),
    transporte_escolar: aluno.transporte_escolar === 1,
    pessoas_autorizadas: text(aluno.pessoas_autorizadas),
    irmaos_gemeos: text(aluno.irmaos_gemeos),
    convenio_medico: text(aluno.convenio_medico),
    hipertensao: aluno.hipertensao === 1,
    diabetes: aluno.diabetes === 1,
    asma: aluno.asma === 1,
    tratamento_medico: text(aluno.tratamento_medico),
    restricao_medicamentos: text(aluno.restricao_medicamentos),
    medicamentos_controlados: text(aluno.medicamentos_controlados),
    restricao_alimentar: text(aluno.restricao_alimentar),
  };
}
