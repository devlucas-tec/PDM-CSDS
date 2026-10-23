import { CORES_RACA, ESCOLARIDADES } from '@/constants/options';
import type { Aluno } from '@/database/types';
import { calculateAge, percent } from '@/lib/format';
import { vulnerabilityLevel, vulnerabilityScore, type VulnerabilityLevel } from '@/lib/vulnerability';

export type ChartItem = { label: string; value: number };

export type DashboardFilters = {
  ano: number | null;
  serie: string | null;
  bairro: string | null;
};

export type DashboardData = {
  total: number;
  bolsaFamilia: { count: number; percent: number };
  deficiencia: number;
  mediaPessoasCasa: number;
  transporte: number;
  idade: ChartItem[];
  genero: ChartItem[];
  corRaca: ChartItem[];
  escolaridadePais: ChartItem[];
  profissoes: ChartItem[];
  tamanhoFamilia: ChartItem[];
  bairros: ChartItem[];
  escolas: ChartItem[];
  condicoesMedicas: ChartItem[];
  restricoesAlimentares: ChartItem[];
  vulnerabilidade: Record<VulnerabilityLevel, { count: number; percent: number }>;
  indiceMedio: number;
};

/** Anos disponíveis no filtro: do primeiro cadastro até o ano atual. */
export function availableYears(students: Pick<Aluno, 'created_at'>[], today = new Date()) {
  const current = today.getFullYear();
  const first = students.reduce((min, s) => Math.min(min, Number(s.created_at.slice(0, 4)) || current), current);
  const years: number[] = [];
  for (let year = Math.min(first, 2024); year <= current; year++) years.push(year);
  return years.reverse();
}

/**
 * Aplica os filtros do dashboard. O filtro de ano considera os alunos que já
 * estavam cadastrados até o fim daquele ano (atendidos no ano de referência).
 */
export function filterStudents(students: Aluno[], filters: DashboardFilters) {
  return students.filter((s) => {
    if (filters.ano !== null && Number(s.created_at.slice(0, 4)) > filters.ano) return false;
    if (filters.serie && s.serie !== filters.serie) return false;
    if (filters.bairro && s.bairro !== filters.bairro) return false;
    return true;
  });
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function sortedItems(counts: Map<string, number>, limit?: number, othersLabel = 'Outros'): ChartItem[] {
  const items = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  if (!limit || items.length <= limit) return items;
  const head = items.slice(0, limit);
  const rest = items.slice(limit).reduce((sum, item) => sum + item.value, 0);
  return [...head, { label: othersLabel, value: rest }];
}

/** Padroniza textos digitados livremente ("PEDREIRO ", "pedreiro" → "Pedreiro"). */
function normalizeText(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function computeDashboard(students: Aluno[], referenceYear: number | null, today = new Date()): DashboardData {
  const total = students.length;
  const reference =
    referenceYear !== null && referenceYear < today.getFullYear() ? new Date(referenceYear, 11, 31) : today;

  const bolsa = students.filter((s) => s.bolsa_familia === 1).length;
  const withHousehold = students.filter((s) => (s.total_pessoas_casa ?? 0) > 0);
  const householdSum = withHousehold.reduce((sum, s) => sum + (s.total_pessoas_casa ?? 0), 0);

  const ageBuckets = [
    { label: '5–7', min: 0, max: 7 },
    { label: '8–10', min: 8, max: 10 },
    { label: '11–13', min: 11, max: 13 },
    { label: '14+', min: 14, max: Infinity },
  ];
  const ages = students.map((s) => calculateAge(s.data_nascimento, reference));

  const familyBuckets = [
    { label: '1–3', min: 1, max: 3 },
    { label: '4–5', min: 4, max: 5 },
    { label: '6+', min: 6, max: Infinity },
  ];

  const educationCounts = new Map<string, number>(ESCOLARIDADES.map((e) => [e, 0]));
  for (const s of students) {
    for (const value of [s.escolaridade_mae, s.escolaridade_pai]) {
      if (value && educationCounts.has(value)) educationCounts.set(value, (educationCounts.get(value) ?? 0) + 1);
    }
  }

  const professions = new Map<string, number>();
  for (const s of students) {
    for (const value of [normalizeText(s.profissao_mae), normalizeText(s.profissao_pai)]) {
      if (value) professions.set(value, (professions.get(value) ?? 0) + 1);
    }
  }

  const levels: Record<VulnerabilityLevel, number> = { baixa: 0, media: 0, alta: 0 };
  let scoreSum = 0;
  for (const s of students) {
    const score = vulnerabilityScore(s);
    scoreSum += score;
    levels[vulnerabilityLevel(score)]++;
  }

  const raceCounts = countBy(students, (s) => s.cor_raca ?? 'Não declarado');

  return {
    total,
    bolsaFamilia: { count: bolsa, percent: percent(bolsa, total) },
    deficiencia: students.filter((s) => s.possui_deficiencia === 1).length,
    mediaPessoasCasa: withHousehold.length ? Math.round((householdSum / withHousehold.length) * 10) / 10 : 0,
    transporte: students.filter((s) => s.transporte_escolar === 1).length,
    idade: ageBuckets.map((b) => ({ label: b.label, value: ages.filter((age) => age >= b.min && age <= b.max).length })),
    genero: [
      { label: 'Meninos', value: students.filter((s) => s.sexo === 'M').length },
      { label: 'Meninas', value: students.filter((s) => s.sexo === 'F').length },
    ],
    corRaca: CORES_RACA.map((label) => ({ label, value: raceCounts.get(label) ?? 0 })),
    escolaridadePais: [...educationCounts.entries()].map(([label, value]) => ({ label, value })),
    profissoes: sortedItems(professions).slice(0, 5),
    tamanhoFamilia: familyBuckets.map((b) => ({
      label: b.label,
      value: withHousehold.filter((s) => (s.total_pessoas_casa ?? 0) >= b.min && (s.total_pessoas_casa ?? 0) <= b.max).length,
    })),
    bairros: sortedItems(countBy(students, (s) => s.bairro), 5),
    escolas: sortedItems(countBy(students, (s) => s.escola_origem), 6),
    condicoesMedicas: [
      { label: 'Asma', value: students.filter((s) => s.asma === 1).length },
      { label: 'Diabetes', value: students.filter((s) => s.diabetes === 1).length },
      { label: 'Hipertensão', value: students.filter((s) => s.hipertensao === 1).length },
    ],
    restricoesAlimentares: sortedItems(
      countBy(students, (s) => (s.restricao_alimentar && s.restricao_alimentar !== 'Nenhuma' ? s.restricao_alimentar : null)),
    ),
    vulnerabilidade: {
      baixa: { count: levels.baixa, percent: percent(levels.baixa, total) },
      media: { count: levels.media, percent: percent(levels.media, total) },
      alta: { count: levels.alta, percent: percent(levels.alta, total) },
    },
    indiceMedio: total ? Math.round((scoreSum / total / 5) * 100) : 0,
  };
}
