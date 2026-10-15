import type { TrafficPropagator, TrafficPropagation } from './TrafficPropagator.js';
import type { ComponentResult, SystemResult } from './types.js';

/**
 * Consolida os resultados por componente em resultados do sistema.
 *
 * - Gargalo: componente com maior demanda por instância (visitas × S / c),
 *   ou seja, o primeiro a saturar quando o tráfego cresce. Definido mesmo com
 *   tráfego zero.
 * - Capacidade máxima: menor tráfego de entrada que leva algum componente a 100%.
 * - Capacidade segura: o mesmo, até o limite seguro.
 * - Tempo de resposta de ponta a ponta: Σ visitas síncronas × R por visita.
 * - Atraso em segundo plano: tempo do trabalho disparado por ligações
 *   assíncronas. Quando há vários ramos, vale o mais lento (rodam em paralelo).
 */
export class SystemAnalyzer {
  analyze(
    components: ComponentResult[],
    propagation: TrafficPropagation,
    propagator: TrafficPropagator,
    entryRps: number,
  ): SystemResult {
    const byId = new Map(components.map((c) => [c.id, c]));
    const queued = components.filter((c) => c.reachable && c.type !== 'external');

    // Gargalo e capacidades
    let bottleneck: ComponentResult | null = null;
    for (const id of propagation.order) {
      const c = byId.get(id)!;
      if (!c.reachable || c.type === 'external' || c.maxEntryRps === null) continue;
      if (bottleneck === null || c.maxEntryRps < bottleneck.maxEntryRps!) bottleneck = c;
    }
    const maxCapacityRps = bottleneck?.maxEntryRps ?? null;
    const safeCapacityRps = bottleneck?.safeEntryRps ?? null;

    const saturated = queued.some((c) => c.saturated);

    // Tempo de resposta síncrono (ms)
    let responseTimeMs: number | null = 0;
    for (const c of components) {
      if (!c.reachable || c.syncVisits === 0) continue;
      if (c.responseTimeMs === null) {
        responseTimeMs = null;
        break;
      }
      responseTimeMs += c.syncVisits * c.responseTimeMs;
    }

    // Trabalho em segundo plano
    const perVisitMs = new Map(components.map((c) => [c.id, c.responseTimeMs]));
    const background = this.backgroundDelay(propagation, propagator, perVisitMs);

    return {
      bottleneckId: bottleneck?.id ?? null,
      safeCapacityRps,
      maxCapacityRps,
      saturated,
      responseTimeMs,
      hasBackgroundWork: background.hasWork,
      backgroundDelayMs: background.delayMs,
      requestsInFlight: responseTimeMs === null ? null : entryRps * (responseTimeMs / 1000),
      monthlyCost: sum(components.map((c) => c.monthlyCost)),
      extraMonthlyCost: sum(components.map((c) => c.extraMonthlyCost)),
    };
  }

  private backgroundDelay(
    entry: TrafficPropagation,
    propagator: TrafficPropagator,
    perVisitMs: Map<string, number | null>,
  ): { hasWork: boolean; delayMs: number | null } {
    const memo = new Map<string, number | null>();

    /** Tempo para concluir um job que começa em `startId`, incluindo jobs aninhados. */
    const jobTime = (startId: string): number | null => {
      if (memo.has(startId)) return memo.get(startId)!;
      const job = propagator.propagate(startId);
      let total: number | null = 0;
      for (const [id, sv] of job.syncVisits) {
        if (sv === 0) continue;
        const r = perVisitMs.get(id);
        if (r === null || r === undefined) {
          total = null;
          break;
        }
        total += sv * r;
      }
      if (total !== null) {
        const nested = asyncTargetsFrom(job, propagator);
        let worst = 0;
        for (const t of nested) {
          const n = jobTime(t);
          if (n === null) {
            worst = Infinity;
            break;
          }
          worst = Math.max(worst, n);
        }
        total = Number.isFinite(worst) ? total + worst : null;
      }
      memo.set(startId, total);
      return total;
    };

    const targets = asyncTargetsFrom(entry, propagator);
    if (targets.length === 0) return { hasWork: false, delayMs: 0 };

    let delay = 0;
    for (const t of targets) {
      const d = jobTime(t);
      if (d === null) return { hasWork: true, delayMs: null };
      delay = Math.max(delay, d);
    }
    return { hasWork: true, delayMs: delay };
  }
}

/**
 * Destinos de ligações assíncronas disparadas pelo caminho síncrono de uma
 * propagação (com peso > 0). Os jobs disparados dentro de outro job são
 * tratados recursivamente por `jobTime`.
 */
function asyncTargetsFrom(p: TrafficPropagation, propagator: TrafficPropagator): string[] {
  const targets = new Set<string>();
  for (const id of p.order) {
    if ((p.syncVisits.get(id) ?? 0) === 0) continue;
    for (const l of propagator.linksFrom(id)) {
      if (l.async && l.callsPerRequest > 0) targets.add(l.target);
    }
  }
  return [...targets];
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
