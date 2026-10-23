import { UFS } from '@/constants/options';
import { brToIso, onlyDigits } from '@/lib/format';

export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email.trim());
}

/** Validação do CPF pelos dígitos verificadores. */
export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

// ---------- Usuário ----------

export type UserFormValues = {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
};

export function validateUser(values: UserFormValues): FieldErrors<keyof UserFormValues> {
  const errors: FieldErrors<keyof UserFormValues> = {};
  if (values.nome.trim().length < 3) errors.nome = 'Informe o nome completo.';
  if (!values.email.trim()) errors.email = 'Informe o email.';
  else if (!isValidEmail(values.email)) errors.email = 'Email em formato inválido.';
  if (!values.senha) errors.senha = 'Informe a senha.';
  else if (values.senha.length < 8) errors.senha = 'A senha deve ter no mínimo 8 caracteres.';
  if (!values.confirmarSenha) errors.confirmarSenha = 'Confirme a senha.';
  else if (values.senha !== values.confirmarSenha) errors.confirmarSenha = 'As senhas não são iguais.';
  return errors;
}

export function validateLogin(email: string, senha: string): FieldErrors<'email' | 'senha'> {
  const errors: FieldErrors<'email' | 'senha'> = {};
  if (!email.trim()) errors.email = 'Informe o email.';
  else if (!isValidEmail(email)) errors.email = 'Email em formato inválido.';
  if (!senha) errors.senha = 'Informe a senha.';
  return errors;
}

// ---------- Aluno ----------

/** Valores do formulário de aluno: tudo em texto, como digitado na tela. */
export type StudentFormValues = {
  nome: string;
  nome_social: string;
  cpf: string;
  rg: string;
  nacionalidade: string;
  pais_origem: string;
  sexo: string;
  cor_raca: string;
  data_nascimento: string; // dd/mm/aaaa
  municipio_nascimento: string;
  uf_nascimento: string;

  bolsa_familia: boolean;
  possui_deficiencia: boolean;
  descricao_deficiencia: string;

  nome_mae: string;
  escolaridade_mae: string;
  profissao_mae: string;
  nome_pai: string;
  escolaridade_pai: string;
  profissao_pai: string;
  responsavel: string;
  parentesco_responsavel: string;
  total_pessoas_casa: string;
  tipo_moradia: string;

  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;

  escola_origem: string;
  cidade_escola: string;
  serie: string;
  ano_conclusao: string;

  transporte_escolar: boolean;
  pessoas_autorizadas: string;
  irmaos_gemeos: string;

  convenio_medico: string;
  hipertensao: boolean;
  diabetes: boolean;
  asma: boolean;
  tratamento_medico: string;
  restricao_medicamentos: string;
  medicamentos_controlados: string;
  restricao_alimentar: string;
};

export type StudentField = keyof StudentFormValues;

export function validateStudent(values: StudentFormValues, today = new Date()): FieldErrors<StudentField> {
  const errors: FieldErrors<StudentField> = {};

  if (!values.nome.trim()) errors.nome = 'O nome do aluno é obrigatório.';
  else if (values.nome.trim().length < 3) errors.nome = 'Informe o nome completo.';

  if (!values.data_nascimento.trim()) {
    errors.data_nascimento = 'A data de nascimento é obrigatória.';
  } else {
    const iso = brToIso(values.data_nascimento);
    if (!iso) errors.data_nascimento = 'Data inválida. Use o formato dd/mm/aaaa.';
    else {
      const birth = new Date(`${iso}T00:00:00`);
      const minimum = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      if (birth > today) errors.data_nascimento = 'A data de nascimento não pode estar no futuro.';
      else if (birth < minimum) errors.data_nascimento = 'Data fora do intervalo esperado para um aluno.';
    }
  }

  if (values.cpf.trim() && !isValidCpf(values.cpf)) errors.cpf = 'CPF inválido.';
  if (values.uf_nascimento && !UFS.includes(values.uf_nascimento as (typeof UFS)[number]))
    errors.uf_nascimento = 'UF inválida.';

  if (values.possui_deficiencia && !values.descricao_deficiencia.trim())
    errors.descricao_deficiencia = 'Descreva a deficiência.';

  if (!values.nome_mae.trim()) errors.nome_mae = 'O nome da mãe é obrigatório.';

  if (values.total_pessoas_casa.trim()) {
    const total = Number(values.total_pessoas_casa);
    if (!Number.isInteger(total) || total < 1 || total > 30)
      errors.total_pessoas_casa = 'Informe um número entre 1 e 30.';
  }

  if (!values.bairro.trim()) errors.bairro = 'O bairro é obrigatório.';
  if (!values.cidade.trim()) errors.cidade = 'A cidade é obrigatória.';
  if (values.uf && !UFS.includes(values.uf as (typeof UFS)[number])) errors.uf = 'UF inválida.';
  if (values.cep.trim() && onlyDigits(values.cep).length !== 8) errors.cep = 'CEP deve ter 8 dígitos.';
  if (values.telefone.trim()) {
    const length = onlyDigits(values.telefone).length;
    if (length < 10 || length > 11) errors.telefone = 'Telefone deve ter DDD + número.';
  }

  if (values.ano_conclusao.trim()) {
    const year = Number(values.ano_conclusao);
    if (!/^\d{4}$/.test(values.ano_conclusao.trim()) || year < 2000 || year > today.getFullYear() + 1)
      errors.ano_conclusao = `Informe um ano entre 2000 e ${today.getFullYear() + 1}.`;
  }

  return errors;
}

export type HistoryFormValues = { tipo: string; descricao: string; data_evento: string };

export function validateHistory(values: HistoryFormValues, today = new Date()): FieldErrors<keyof HistoryFormValues> {
  const errors: FieldErrors<keyof HistoryFormValues> = {};
  if (!values.tipo.trim()) errors.tipo = 'Selecione o tipo de registro.';
  if (values.descricao.trim().length < 5) errors.descricao = 'Descreva o evento (mínimo 5 caracteres).';
  const iso = brToIso(values.data_evento);
  if (!values.data_evento.trim()) errors.data_evento = 'Informe a data do evento.';
  else if (!iso) errors.data_evento = 'Data inválida. Use o formato dd/mm/aaaa.';
  else if (new Date(`${iso}T00:00:00`) > today) errors.data_evento = 'A data do evento não pode estar no futuro.';
  return errors;
}

export function hasErrors(errors: object) {
  return Object.keys(errors).length > 0;
}
