/** admin: tudo, inclusive usuários · coordenador: gestão pedagógica · professor: suas oficinas. */
export type Perfil = 'admin' | 'coordenador' | 'professor';

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  telefone: string | null;
  created_at: string;
};

/** 0 = não, 1 = sim. O banco só aceita esses dois valores (CHECK). */
export type SimNao = 0 | 1;

export type Sexo = 'M' | 'F';

/** Todos os campos da ficha cadastral do aluno, exceto os de controle. */
export type AlunoInput = {
  nome: string;
  nome_social: string | null;
  cpf: string | null;
  rg: string | null;
  nacionalidade: string | null;
  pais_origem: string | null;
  sexo: Sexo | null;
  cor_raca: string | null;
  data_nascimento: string; // ISO yyyy-mm-dd
  municipio_nascimento: string | null;
  uf_nascimento: string | null;

  bolsa_familia: SimNao;
  possui_deficiencia: SimNao;
  descricao_deficiencia: string | null;

  nome_mae: string;
  escolaridade_mae: string | null;
  profissao_mae: string | null;
  nome_pai: string | null;
  escolaridade_pai: string | null;
  profissao_pai: string | null;
  responsavel: string | null;
  parentesco_responsavel: string | null;
  total_pessoas_casa: number | null;
  tipo_moradia: string | null;

  rua: string | null;
  bairro: string;
  cidade: string;
  uf: string | null;
  cep: string | null;
  telefone: string | null;

  escola_origem: string | null;
  cidade_escola: string | null;
  serie: string | null;
  ano_conclusao: number | null;

  transporte_escolar: SimNao;
  pessoas_autorizadas: string | null;
  irmaos_gemeos: string | null;

  convenio_medico: string | null;
  hipertensao: SimNao;
  diabetes: SimNao;
  asma: SimNao;
  tratamento_medico: string | null;
  restricao_medicamentos: string | null;
  medicamentos_controlados: string | null;
  restricao_alimentar: string | null;
};

export type Aluno = AlunoInput & {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
};

/** Aluno com os nomes de quem cadastrou e de quem alterou por último. */
export type AlunoDetalhado = Aluno & {
  created_by_nome: string | null;
  updated_by_nome: string | null;
};

export type RegistroHistorico = {
  id: number;
  aluno_id: number;
  tipo: string;
  descricao: string;
  data_evento: string;
  usuario_id: number | null;
  usuario_nome: string | null;
  created_at: string;
};

export type HistoricoInput = {
  tipo: string;
  descricao: string;
  data_evento: string;
};

// ---------- Oficinas, calendário, presença e comportamento ----------

export type Oficina = {
  id: number;
  nome: string;
  descricao: string | null;
  local: string | null;
  created_at: string;
};

/** Oficina com contagens, usada nas listagens. */
export type OficinaResumo = Oficina & {
  professores: string | null; // nomes separados por vírgula
  total_alunos: number;
  total_aulas: number;
};

export type StatusAula = 'agendada' | 'remarcada' | 'cancelada';

export type Aula = {
  id: number;
  oficina_id: number;
  data: string; // yyyy-mm-dd
  hora_inicio: string; // HH:MM
  hora_fim: string;
  status: StatusAula;
  data_original: string | null;
  justificativa: string | null;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
};

/** Aula com o nome da oficina e o andamento da chamada. */
export type AulaDetalhada = Aula & {
  oficina_nome: string;
  oficina_local: string | null;
  professores: string | null;
  total_matriculados: number;
  total_registrados: number;
  total_presentes: number;
};

export type ChamadaItem = {
  aluno_id: number;
  nome: string;
  nome_social: string | null;
  data_nascimento: string;
  /** null = chamada ainda não registrada para este aluno. */
  presente: 0 | 1 | null;
  relatorios: number;
};

export type StatusRelatorio = 'novo' | 'lido' | 'contato_realizado';

export type RelatorioComportamento = {
  id: number;
  aluno_id: number;
  aula_id: number | null;
  professor_id: number | null;
  texto: string;
  status: StatusRelatorio;
  observacao_coordenacao: string | null;
  created_at: string;
  updated_at: string;
};

export type RelatorioDetalhado = RelatorioComportamento & {
  aluno_nome: string;
  professor_nome: string | null;
  oficina_nome: string | null;
  aula_data: string | null;
};

export type FrequenciaOficina = {
  oficina_id: number;
  oficina_nome: string;
  total: number;
  presentes: number;
};
