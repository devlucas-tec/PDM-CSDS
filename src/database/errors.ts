/** Erro de regra de negócio, com mensagem pronta para exibir ao usuário. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export function errorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado. Tente novamente.') {
  if (error instanceof DomainError) return error.message;
  return fallback;
}
