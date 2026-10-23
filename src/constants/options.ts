/** Listas de opções usadas nos formulários, filtros e no dashboard. */

export const SERIES = [
  '1º ano',
  '2º ano',
  '3º ano',
  '4º ano',
  '5º ano',
  '6º ano',
  '7º ano',
  '8º ano',
  '9º ano',
  'Ensino médio',
] as const;

export const CORES_RACA = ['Amarela', 'Branca', 'Indígena', 'Parda', 'Preta', 'Não declarado'] as const;

export const ESCOLARIDADES = [
  'Não estudou',
  'Fundamental incompleto',
  'Fundamental completo',
  'Ensino médio',
  'Ensino superior',
] as const;

/** Escolaridades consideradas baixas no índice de vulnerabilidade. */
export const ESCOLARIDADES_BAIXAS: readonly string[] = ['Não estudou', 'Fundamental incompleto'];

export const TIPOS_MORADIA = ['Própria', 'Alugada', 'Cedida', 'Ocupação', 'Precária (taipa/improvisada)'] as const;

/** Tipos de moradia considerados precários no índice de vulnerabilidade. */
export const MORADIAS_PRECARIAS: readonly string[] = ['Ocupação', 'Precária (taipa/improvisada)'];

export const PARENTESCOS = ['Mãe', 'Pai', 'Avó/Avô', 'Tia/Tio', 'Irmã/Irmão', 'Outro'] as const;

export const RESTRICOES_ALIMENTARES = [
  'Nenhuma',
  'Intolerância à lactose',
  'Alergia ao glúten',
  'Outras alergias alimentares',
  'Outra',
] as const;

export const TIPOS_HISTORICO = [
  'Entrada no projeto',
  'Mudança de escola',
  'Mudança de série',
  'Acompanhamento pedagógico',
  'Acompanhamento social',
  'Ocorrência relevante',
  'Participação em atividade',
  'Observação de professor/coordenação',
  'Avaliação qualitativa',
] as const;

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
