import { Router } from 'express';
import Joi from 'joi';
import { validateBody } from '../middlewares/validateBody.js';

interface WaitlistEntry {
  feature: string;
  createdAt: string;
}

const schema = Joi.object<{ feature: string }>({ feature: Joi.string().trim().min(1).max(40).required() });

/**
 * PROVISÓRIO: guarda as inscrições em memória até existirem banco e
 * autenticação. Na versão final grava em `pro_waitlist` com o id do usuário.
 */
export function createWaitlistRouter(): Router {
  const router = Router();
  const entries: WaitlistEntry[] = [];

  router.post('/pro', validateBody(schema), (req, res) => {
    entries.push({ feature: (req.body as { feature: string }).feature, createdAt: new Date().toISOString() });
    res.status(201).json({ subscribed: true });
  });

  return router;
}
