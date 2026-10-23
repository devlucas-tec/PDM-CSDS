import type { Perfil } from '@/database/types';

/** Rótulos exibidos na interface. */
export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: 'Administrador',
  coordenador: 'Coordenador',
  professor: 'Professor',
};

/**
 * Administrador e coordenador fazem a gestão pedagógica: alunos, calendário,
 * oficinas, relatórios de comportamento e dashboard.
 */
export function isGestor(perfil: Perfil | undefined | null) {
  return perfil === 'admin' || perfil === 'coordenador';
}

/** Apenas o administrador cadastra usuários. */
export function canManageUsers(perfil: Perfil | undefined | null) {
  return perfil === 'admin';
}
