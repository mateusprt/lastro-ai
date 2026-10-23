import { Router } from 'express';
import { SimulationController } from '../controllers/simulation.controller.js';
import { validateBody } from '../middlewares/validateBody.js';
import { SimulationService } from '../services/simulation.service.js';
import { simulationInputSchema } from '../validation/simulation.schema.js';
import { HttpError } from '../http/errors.js';
import { createWaitlistRouter } from './waitlist.js';

export function createRouter(): Router {
  const router = Router();
  const simulations = new SimulationController(new SimulationService());

  router.get('/health', (_req, res) => {
    // TODO: incluir o status do Postgres quando o banco entrar.
    res.json({ status: 'ok' });
  });

  // TODO: exigir autenticação e aplicar limite de requisições e de plano.
  router.post('/simulations', validateBody(simulationInputSchema), simulations.create);

  router.use('/waitlist', createWaitlistRouter());

  router.use((_req, _res) => {
    throw new HttpError(404, 'NOT_FOUND', 'Rota não encontrada.');
  });

  return router;
}
