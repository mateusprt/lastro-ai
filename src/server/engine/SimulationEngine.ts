import { ComponentAnalyzer } from './ComponentAnalyzer.js';
import { DEFAULT_LIMITS, GraphValidator, type GraphValidatorLimits } from './GraphValidator.js';
import { DEFAULT_CURVE_OPTIONS, ResponseCurveBuilder, type CurveOptions } from './ResponseCurveBuilder.js';
import { SystemAnalyzer } from './SystemAnalyzer.js';
import { TrafficPropagator } from './TrafficPropagator.js';
import type { LinkResult, SimulationInput, SimulationResult } from './types.js';

export interface SimulationEngineOptions {
  limits?: GraphValidatorLimits;
  curve?: CurveOptions;
}

/**
 * Ponto de entrada único do motor. É a única classe que a API usa.
 *
 * Fluxo: validar → propagar tráfego → analisar componentes → analisar sistema → curva.
 * O motor é puro e síncrono: não acessa banco, rede nem relógio.
 *
 * @throws SimulationValidationError quando o grafo ou os parâmetros são inválidos.
 */
export class SimulationEngine {
  private readonly validator: GraphValidator;
  private readonly componentAnalyzer = new ComponentAnalyzer();
  private readonly systemAnalyzer = new SystemAnalyzer();
  private readonly curveBuilder: ResponseCurveBuilder;

  constructor(options: SimulationEngineOptions = {}) {
    this.validator = new GraphValidator(options.limits ?? DEFAULT_LIMITS);
    this.curveBuilder = new ResponseCurveBuilder(
      this.componentAnalyzer,
      options.curve ?? DEFAULT_CURVE_OPTIONS,
    );
  }

  run(input: SimulationInput): SimulationResult {
    this.validator.validate(input);

    const { graph, entryPointId, trafficRps, safeUtilization } = input;
    const propagator = new TrafficPropagator(graph);
    const propagation = propagator.propagate(entryPointId);

    const components = graph.components.map((spec) =>
      this.componentAnalyzer.analyze(
        spec,
        {
          visits: propagation.visits.get(spec.id)!,
          syncVisits: propagation.syncVisits.get(spec.id)!,
          reachable: propagation.reachable.has(spec.id),
        },
        trafficRps,
        safeUtilization,
      ),
    );

    const links: LinkResult[] = graph.links.map((l) => ({
      ...(l.id !== undefined ? { id: l.id } : {}),
      source: l.source,
      target: l.target,
      async: l.async,
      throughputRps: trafficRps * propagation.visits.get(l.source)! * l.callsPerRequest,
    }));

    const system = this.systemAnalyzer.analyze(components, propagation, propagator, trafficRps);
    const curve = this.curveBuilder.build(graph.components, propagation, system.maxCapacityRps, trafficRps);

    return {
      input: { entryPointId, trafficRps, safeUtilization },
      components,
      links,
      system,
      curve,
    };
  }
}
