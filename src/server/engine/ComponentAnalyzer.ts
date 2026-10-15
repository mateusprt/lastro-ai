import { QueueModel } from './QueueModel.js';
import type { ComponentResult, ComponentSpec, ComponentStatus } from './types.js';

/** Fração do limite seguro a partir da qual o componente entra em "atenção". */
export const WARNING_RATIO = 0.75;

export interface ComponentLoad {
  visits: number;
  syncVisits: number;
  reachable: boolean;
}

/**
 * Calcula as métricas de um componente para um tráfego de entrada.
 *
 * - Vazão: X = λ × visitas.
 * - Utilização (Lei da Utilização): U = X × S / c.
 * - Tempo de resposta por visita: fila M/M/c (Erlang C).
 * - Serviço externo: latência fixa, sem fila, sem utilização.
 */
export class ComponentAnalyzer {
  analyze(
    component: ComponentSpec,
    load: ComponentLoad,
    entryRps: number,
    safeUtilization: number,
  ): ComponentResult {
    const S = component.serviceTimeMs / 1000;
    const c = component.instances;
    const throughputRps = entryRps * load.visits;
    const serviceDemandMs = load.visits * component.serviceTimeMs;
    const monthlyCost = c * component.monthlyCostPerInstance;

    const base = {
      id: component.id,
      name: component.name,
      type: component.type,
      reachable: load.reachable,
      visits: load.visits,
      syncVisits: load.syncVisits,
      throughputRps,
      serviceDemandMs,
      instances: c,
      monthlyCost,
    };

    if (component.type === 'external') {
      return {
        ...base,
        utilization: 0,
        saturated: false,
        waitProbability: 0,
        waitTimeMs: 0,
        responseTimeMs: component.serviceTimeMs,
        status: 'ok',
        requiredInstances: c,
        additionalInstances: 0,
        extraMonthlyCost: 0,
        maxEntryRps: null,
        safeEntryRps: null,
      };
    }

    const q = QueueModel.analyze(throughputRps, S, c);
    const required = Math.max(c, QueueModel.requiredServers(q.offeredLoad, safeUtilization));
    const demandPerInstanceS = (load.visits * S) / c;
    const maxEntryRps = demandPerInstanceS > 0 ? 1 / demandPerInstanceS : null;

    return {
      ...base,
      utilization: q.utilization,
      saturated: q.saturated,
      waitProbability: q.waitProbability,
      waitTimeMs: q.saturated ? null : q.waitTimeS * 1000,
      responseTimeMs: q.saturated ? null : q.responseTimeS * 1000,
      status: statusFor(q.utilization, safeUtilization),
      requiredInstances: required,
      additionalInstances: required - c,
      extraMonthlyCost: (required - c) * component.monthlyCostPerInstance,
      maxEntryRps,
      safeEntryRps: maxEntryRps === null ? null : maxEntryRps * safeUtilization,
    };
  }

  /**
   * Tempo de resposta por visita, em segundos, sem montar o resultado
   * completo. Usado para gerar a curva de resposta com muitos pontos.
   */
  responseTimeS(component: ComponentSpec, visits: number, entryRps: number): number {
    const S = component.serviceTimeMs / 1000;
    if (component.type === 'external') return S;
    return QueueModel.analyze(entryRps * visits, S, component.instances).responseTimeS;
  }
}

export function statusFor(utilization: number, safeUtilization: number): ComponentStatus {
  if (utilization >= safeUtilization) return 'critical';
  if (utilization >= safeUtilization * WARNING_RATIO) return 'warning';
  return 'ok';
}
