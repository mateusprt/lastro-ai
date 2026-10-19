import { SimulationEngine, type SimulationInput, type SimulationResult } from '../engine/index.js';

/**
 * Único ponto do backend que chama o motor. Aqui entrarão a verificação de
 * limites de plano (componentes por diagrama) e o registro de uso por usuário.
 */
export class SimulationService {
  constructor(private readonly engine = new SimulationEngine()) {}

  simulate(input: SimulationInput): SimulationResult {
    return this.engine.run(input);
  }
}
