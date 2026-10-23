import type { ComponentAnalyzer } from './ComponentAnalyzer.js';
import type { TrafficPropagation } from './TrafficPropagator.js';
import type { ComponentSpec, CurvePoint } from './types.js';

export interface CurveOptions {
  /** Número de pontos da curva (inclui o tráfego zero). */
  points: number;
  /**
   * Fração da capacidade máxima onde a curva termina. Perto de 100% o tempo
   * de resposta tende ao infinito, então paramos um pouco antes.
   */
  maxCapacityFraction: number;
}

export const DEFAULT_CURVE_OPTIONS: CurveOptions = { points: 50, maxCapacityFraction: 0.98 };

/**
 * Gera os pontos da curva tempo de resposta × tráfego de entrada, de zero
 * até perto da capacidade máxima. É a curva que mostra o "joelho".
 */
export class ResponseCurveBuilder {
  constructor(
    private readonly analyzer: ComponentAnalyzer,
    private readonly options: CurveOptions = DEFAULT_CURVE_OPTIONS,
  ) {}

  build(
    components: ComponentSpec[],
    propagation: TrafficPropagation,
    maxCapacityRps: number | null,
    currentTrafficRps: number,
  ): CurvePoint[] {
    const syncComponents = components.filter(
      (c) => propagation.reachable.has(c.id) && (propagation.syncVisits.get(c.id) ?? 0) > 0,
    );

    const upper =
      maxCapacityRps !== null
        ? maxCapacityRps * this.options.maxCapacityFraction
        : Math.max(currentTrafficRps * 2, 1);

    const n = Math.max(2, Math.floor(this.options.points));
    const points: CurvePoint[] = [];
    for (let i = 0; i < n; i++) {
      const trafficRps = (upper * i) / (n - 1);
      points.push({ trafficRps, responseTimeMs: this.responseTimeMs(syncComponents, propagation, trafficRps) });
    }
    return points;
  }

  /** Tempo de resposta síncrono de ponta a ponta para um tráfego, em ms. */
  responseTimeMs(
    syncComponents: ComponentSpec[],
    propagation: TrafficPropagation,
    trafficRps: number,
  ): number | null {
    let totalS = 0;
    for (const c of syncComponents) {
      const r = this.analyzer.responseTimeS(c, propagation.visits.get(c.id)!, trafficRps);
      if (!Number.isFinite(r)) return null;
      totalS += propagation.syncVisits.get(c.id)! * r;
    }
    return totalS * 1000;
  }
}
