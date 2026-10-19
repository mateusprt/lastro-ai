/** Erro HTTP com código estável para o frontend e mensagem em português. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Corpo padrão de erro da API. */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
