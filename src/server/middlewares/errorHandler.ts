import type { ErrorRequestHandler } from 'express';
import { SimulationValidationError } from '../engine/index.js';
import { HttpError, type ErrorBody } from '../http/errors.js';

/** Tratador de erros central. O Express 5 já encaminha para cá os erros de rotas async. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado no servidor.' } };

  if (err instanceof SimulationValidationError) {
    status = 422;
    body = { error: { code: 'INVALID_GRAPH', message: 'O diagrama não pode ser simulado.', details: err.issues } };
  } else if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } };
  } else if (isBodyParserError(err)) {
    status = err.status;
    body = {
      error: {
        code: err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
        message: err.type === 'entity.too.large' ? 'O diagrama é grande demais.' : 'O corpo da requisição não é um JSON válido.',
      },
    };
  } else {
    // TODO: enviar ao Sentry quando estiver configurado.
    console.error(err);
  }

  res.status(status).json(body);
};

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err && typeof (err as { status: unknown }).status === 'number';
}
