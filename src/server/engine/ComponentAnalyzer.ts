import { QueueModel, type QueueMetrics } from './QueueModel.js';
import {
  DEFAULT_WRITE_FRACTION,
  type ComponentResult,
  type ComponentSpec,
  type ComponentStatus,
  type DatabaseQueueResult,
} from './types.js';

/** Fração do limite seguro a partir da qual o componente entra em "atenção". */
export const WARNING_RATIO = 0.75;

export interface ComponentLoad {
  visits: number;
  syncVisits: number;
  reachable: boolean;
}

/** Campos do resultado que não dependem do modelo de fila. */
type ComponentBase = Pick<
  ComponentResult,
  'id' | 'name' | 'type' | 'reachable' | 'visits' | 'syncVisits' | 'throughputRps' | 'serviceDemandMs' | 'instances' | 'monthlyCost'
>;

/** Filas de um banco para uma vazão. `replicas` é `null` com uma instância só. */
interface DatabaseQueues {
  writeFraction: number;
  primary: QueueMetrics;
  replicas: QueueMetrics | null;
}

/**
 * Calcula as métricas de um componente para um tráfego de entrada.
 *
 * - Vazão: X = λ × visitas.
 * - Utilização (Lei da Utilização): U = X × S / c.
 * - Tempo de resposta por visita: fila M/M/c (Erlang C).
 * - Serviço externo: latência fixa, sem fila, sem utilização.
 * - Banco com mais de uma instância: duas filas. O primário (M/M/1) recebe só
 *   as escritas, X × w; as réplicas (M/M/c com c = instâncias − 1) recebem só
 *   as leituras, X × (1 − w). O tempo por visita é a média ponderada das duas.
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

    const base: ComponentBase = {
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

    if (component.type === 'database') {
      return this.analyzeDatabase(component, base, entryRps, safeUtilization);
    }

    const q = QueueModel.analyze(throughputRps, S, c);
    const required = Math.max(c, QueueModel.requiredServers(q.offeredLoad, safeUtilization));
    const maxEntryRps = maxEntryFor((load.visits * S) / c);

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
    if (component.type === 'database') {
      return databaseResponseS(databaseQueues(component, entryRps * visits));
    }
    return QueueModel.analyze(entryRps * visits, S, component.instances).responseTimeS;
  }

  private analyzeDatabase(
    component: ComponentSpec,
    base: ComponentBase,
    entryRps: number,
    safeUtilization: number,
  ): ComponentResult {
    const visits = base.visits;
    const S = component.serviceTimeMs / 1000;
    const c = component.instances;
    const queues = databaseQueues(component, entryRps * visits);
    const w = queues.writeFraction;
    const writeLoad = entryRps * visits * w * S;
    const readLoad = entryRps * visits * (1 - w) * S;

    // Uma instância basta enquanto aguenta tudo sozinha. Passando disso, a conta
    // é 1 primário + as réplicas que as leituras pedem. As escritas não entram:
    // réplicas não aliviam o primário.
    const fitsSingle = QueueModel.requiredServers(entryRps * visits * S, safeUtilization) <= 1;
    const required = Math.max(c, fitsSingle ? 1 : 1 + QueueModel.requiredServers(readLoad, safeUtilization));
    const primaryOverSafe = QueueModel.requiredServers(writeLoad, safeUtilization) > 1;

    const sizing = {
      ...base,
      requiredInstances: required,
      additionalInstances: required - c,
      extraMonthlyCost: (required - c) * component.monthlyCostPerInstance,
    };

    if (queues.replicas === null) {
      const q = queues.primary;
      const primary = queueResult(1, entryRps * visits, q, visits * S, safeUtilization);
      return {
        ...sizing,
        utilization: q.utilization,
        saturated: q.saturated,
        waitProbability: q.waitProbability,
        waitTimeMs: q.saturated ? null : q.waitTimeS * 1000,
        responseTimeMs: primary.responseTimeMs,
        status: primary.status,
        maxEntryRps: primary.maxEntryRps,
        safeEntryRps: primary.safeEntryRps,
        database: { writeFraction: w, primary, replicas: null, limitedBy: null, primaryOverSafe },
      };
    }

    const p = queues.primary;
    const r = queues.replicas;
    const primary = queueResult(1, entryRps * visits * w, p, visits * w * S, safeUtilization);
    const replicas = queueResult(c - 1, entryRps * visits * (1 - w), r, (visits * (1 - w) * S) / (c - 1), safeUtilization);

    const utilization = Math.max(p.utilization, r.utilization);
    const saturated = p.saturated || r.saturated;
    const maxEntryRps = minOrNull(primary.maxEntryRps, replicas.maxEntryRps);
    // Empate conta como primário: mais réplicas não moveriam o limite.
    const limitedBy = maxEntryRps === null ? null : primary.maxEntryRps === maxEntryRps ? 'primary' : 'replicas';

    return {
      ...sizing,
      utilization,
      saturated,
      waitProbability: w * p.waitProbability + (1 - w) * r.waitProbability,
      waitTimeMs: saturated ? null : (w * p.waitTimeS + (1 - w) * r.waitTimeS) * 1000,
      responseTimeMs: saturated ? null : databaseResponseS(queues) * 1000,
      status: statusFor(utilization, safeUtilization),
      maxEntryRps,
      safeEntryRps: maxEntryRps === null ? null : maxEntryRps * safeUtilization,
      database: { writeFraction: w, primary, replicas, limitedBy, primaryOverSafe },
    };
  }
}

export function statusFor(utilization: number, safeUtilization: number): ComponentStatus {
  if (utilization >= safeUtilization) return 'critical';
  if (utilization >= safeUtilization * WARNING_RATIO) return 'warning';
  return 'ok';
}

function databaseQueues(component: ComponentSpec, throughputRps: number): DatabaseQueues {
  const S = component.serviceTimeMs / 1000;
  const writeFraction = component.writeFraction ?? DEFAULT_WRITE_FRACTION;
  if (component.instances === 1) {
    return { writeFraction, primary: QueueModel.analyze(throughputRps, S, 1), replicas: null };
  }
  return {
    writeFraction,
    primary: QueueModel.analyze(throughputRps * writeFraction, S, 1),
    replicas: QueueModel.analyze(throughputRps * (1 - writeFraction), S, component.instances - 1),
  };
}

/** Tempo por visita: média das duas filas ponderada pela fração de escritas. */
function databaseResponseS({ writeFraction: w, primary, replicas }: DatabaseQueues): number {
  if (replicas === null) return primary.responseTimeS;
  // Uma fila sem carga nunca satura, então peso 0 nunca multiplica Infinity.
  if (primary.saturated || replicas.saturated) return Infinity;
  return w * primary.responseTimeS + (1 - w) * replicas.responseTimeS;
}

function queueResult(
  servers: number,
  throughputRps: number,
  q: QueueMetrics,
  demandPerServerS: number,
  safeUtilization: number,
): DatabaseQueueResult {
  const maxEntryRps = maxEntryFor(demandPerServerS);
  return {
    servers,
    throughputRps,
    utilization: q.utilization,
    saturated: q.saturated,
    responseTimeMs: q.saturated ? null : q.responseTimeS * 1000,
    status: statusFor(q.utilization, safeUtilization),
    maxEntryRps,
    safeEntryRps: maxEntryRps === null ? null : maxEntryRps * safeUtilization,
  };
}

/** Tráfego de entrada que leva uma fila a 100%, dada a demanda por servidor em segundos. */
function maxEntryFor(demandPerServerS: number): number | null {
  return demandPerServerS > 0 ? 1 / demandPerServerS : null;
}

function minOrNull(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}
