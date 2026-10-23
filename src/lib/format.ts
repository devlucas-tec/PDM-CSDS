/** Funções puras de formatação, máscaras e datas. */

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function applyMask(value: string, mask: string) {
  const digits = onlyDigits(value);
  let result = '';
  let i = 0;
  for (const char of mask) {
    if (i >= digits.length) break;
    if (char === '#') {
      result += digits[i++];
    } else {
      result += char;
    }
  }
  return result;
}

export const maskDate = (value: string) => applyMask(value, '##/##/####');
export const maskCpf = (value: string) => applyMask(value, '###.###.###-##');
export const maskCep = (value: string) => applyMask(value, '#####-###');
export const maskPhone = (value: string) =>
  onlyDigits(value).length > 10 ? applyMask(value, '(##) #####-####') : applyMask(value, '(##) ####-####');

/** Converte dd/mm/aaaa em yyyy-mm-dd. Retorna null se a data não existir no calendário. */
export function brToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Converte yyyy-mm-dd (ou um timestamp ISO completo) em dd/mm/aaaa. */
export function isoToBr(value: string | null | undefined) {
  if (!value) return '';
  const [yyyy, mm, dd] = value.slice(0, 10).split('-');
  if (!yyyy || !mm || !dd) return '';
  return `${dd}/${mm}/${yyyy}`;
}

export function todayIso() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export function nowIso() {
  return new Date().toISOString();
}

/** Idade em anos completos na data de referência (padrão: hoje). */
export function calculateAge(birthIso: string, reference = new Date()) {
  const [year, month, day] = birthIso.slice(0, 10).split('-').map(Number);
  let age = reference.getFullYear() - year;
  const beforeBirthday =
    reference.getMonth() + 1 < month || (reference.getMonth() + 1 === month && reference.getDate() < day);
  if (beforeBirthday) age--;
  return age;
}

export function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return isoToBr(iso);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function simNao(value: number | null | undefined) {
  return value === 1 ? 'Sim' : 'Não';
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || name.slice(0, 1).toUpperCase();
}

/** Remove espaços extras; string vazia vira null (para gravar NULL no banco). */
export function emptyToNull(value: string | null | undefined) {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

export function percent(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}
