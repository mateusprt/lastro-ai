import type { RequestHandler } from 'express';
import type { ObjectSchema } from 'joi';
import { HttpError } from '../http/errors.js';

/**
 * Valida e normaliza `req.body` com Joi. Campos desconhecidos são removidos.
 * (Escrito à mão em vez de `celebrate` para não depender de como ele lida com
 * `req.query`, que no Express 5 é somente leitura.)
 */
export function validateBody<T>(schema: ObjectSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true, convert: false });
    if (error) {
      throw new HttpError(
        400,
        'INVALID_REQUEST',
        'A requisição tem campos inválidos.',
        error.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
      );
    }
    req.body = value;
    next();
  };
}
