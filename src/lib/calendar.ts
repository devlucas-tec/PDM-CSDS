/** Funções puras de calendário. Datas sempre no formato yyyy-mm-dd (hora local). */

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export function parseIso(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toIso(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function weekday(iso: string) {
  return parseIso(iso).getDay();
}

/** "segunda-feira, 6 de outubro de 2026" */
export function formatLongDate(iso: string) {
  const date = parseIso(iso);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()].toLowerCase()} de ${date.getFullYear()}`;
}

/** "Seg, 06/10" */
export function formatShortDate(iso: string) {
  const date = parseIso(iso);
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Todas as datas entre `inicio` e `fim` (inclusive) que caem nos dias da
 * semana informados (0 = domingo ... 6 = sábado). Usado para montar o
 * calendário anual de uma oficina.
 */
export function generateDates(inicio: string, fim: string, diasSemana: number[]) {
  const dates: string[] = [];
  if (inicio > fim || diasSemana.length === 0) return dates;
  const wanted = new Set(diasSemana);
  for (let current = inicio; current <= fim; current = addDays(current, 1)) {
    if (wanted.has(weekday(current))) dates.push(current);
  }
  return dates;
}

/** Matriz de semanas (domingo a sábado) de um mês; dias fora do mês são null. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toIso(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function monthRange(year: number, month: number) {
  return { from: toIso(new Date(year, month, 1)), to: toIso(new Date(year, month + 1, 0)) };
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string) {
  return TIME_REGEX.test(value);
}

export function maskTime(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}
