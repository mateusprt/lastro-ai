import type { ComponentSpec } from '../../shared/simulation.js';
import type { ComponentData } from '../store/types.js';

/**
 * Modelagem avançada: valores sugeridos e a tradução dos campos do editor para
 * o formato da API. Um campo nunca preenchido usa o valor sugerido, para o
 * usuário ver um número plausível assim que liga o recurso.
 */
export const ADVANCED_DEFAULTS = {
  /** Máximo do autoscaling, como múltiplo do mínimo. */
  autoscalingMaxFactor: 4,
  autoscalingTarget: 0.6,
  hitRate: 0.8,
  /** O padrão do Postgres (max_connections). */
  poolSize: 100,
  poolExtraHoldMs: 0,
  rateLimitRps: 100,
} as const;

export const canAutoscale = (d: Pick<ComponentData, 'type'>) => d.type === 'app' || d.type === 'worker';

export function autoscalingMax(d: ComponentData): number {
  // Nunca abaixo do mínimo: se o usuário sobe as instâncias, o máximo acompanha.
  return Math.max(d.instances, d.autoscalingMax ?? d.instances * ADVANCED_DEFAULTS.autoscalingMaxFactor);
}
export const autoscalingTarget = (d: ComponentData) => d.autoscalingTarget ?? ADVANCED_DEFAULTS.autoscalingTarget;
export const hitRate = (d: ComponentData) => d.hitRate ?? ADVANCED_DEFAULTS.hitRate;
export const poolSize = (d: ComponentData) => d.poolSize ?? ADVANCED_DEFAULTS.poolSize;
export const poolExtraHoldMs = (d: ComponentData) => d.poolExtraHoldMs ?? ADVANCED_DEFAULTS.poolExtraHoldMs;
export const rateLimitRps = (d: ComponentData) => d.rateLimitRps ?? ADVANCED_DEFAULTS.rateLimitRps;

/** Campos avançados do componente no formato da API. Vazio quando o recurso não se aplica ou está desligado. */
export function advancedSpec(d: ComponentData): Partial<ComponentSpec> {
  if (canAutoscale(d) && d.autoscalingEnabled) {
    return { autoscaling: { maxInstances: autoscalingMax(d), targetUtilization: autoscalingTarget(d) } };
  }
  if (d.type === 'cache') return { hitRate: hitRate(d) };
  if (d.type === 'database' && d.poolEnabled) return { connectionPool: { size: poolSize(d), extraHoldMs: poolExtraHoldMs(d) } };
  if (d.type === 'external' && d.rateLimitEnabled) return { rateLimitRps: rateLimitRps(d) };
  return {};
}
