import Joi from 'joi';
import { COMPONENT_TYPES, type SimulationInput } from '../../shared/simulation.js';

/**
 * Formato da requisição de simulação. Regras que dependem do grafo inteiro
 * (ciclos, referências, duplicidades) ficam no GraphValidator do motor.
 */
const id = Joi.string().trim().min(1).max(64);

const component = Joi.object({
  id: id.required(),
  name: Joi.string().trim().max(80).allow('').required(),
  type: Joi.string()
    .valid(...COMPONENT_TYPES)
    .required(),
  instances: Joi.number().integer().min(1).required(),
  serviceTimeMs: Joi.number().min(0).required(),
  monthlyCostPerInstance: Joi.number().min(0).required(),
  writeFraction: Joi.number().min(0).max(1),
  position: Joi.object({ x: Joi.number().required(), y: Joi.number().required() }),
});

const link = Joi.object({
  id: id,
  source: id.required(),
  target: id.required(),
  callsPerRequest: Joi.number().min(0).required(),
  async: Joi.boolean().required(),
});

export const simulationInputSchema = Joi.object<SimulationInput>({
  graph: Joi.object({
    components: Joi.array().items(component).min(1).max(200).required(),
    links: Joi.array().items(link).max(1000).required(),
  }).required(),
  entryPointId: id.required(),
  trafficRps: Joi.number().min(0).required(),
  safeUtilization: Joi.number().greater(0).less(1).required(),
});
