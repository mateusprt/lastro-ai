import type { Request, Response } from 'express';
import type { SimulationInput } from '../../shared/simulation.js';
import type { SimulationService } from '../services/simulation.service.js';

export class SimulationController {
  constructor(private readonly service: SimulationService) {}

  create = (req: Request<unknown, unknown, SimulationInput>, res: Response): void => {
    res.json(this.service.simulate(req.body));
  };
}
