import express, { type Express } from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { createRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // TODO: helmet, express-rate-limit, cookies e checagem de Origin (seção de autenticação do TDD).
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', createRouter());
  app.use(errorHandler);
  return app;
}
