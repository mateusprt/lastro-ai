import type { SimulationInput } from '../../shared/simulation.js';
import type { DiagramDoc, LinkEdge } from '../store/types.js';

/**
 * Monta o corpo de POST /simulations a partir do documento. As posições ficam
 * de fora: não mudam o resultado, e assim arrastar um nó não dispara simulação.
 */
export function toSimulationInput(doc: DiagramDoc): SimulationInput | null {
  if (doc.nodes.length === 0 || doc.entryPointId === null) return null;
  return {
    graph: {
      components: doc.nodes.map((n) => ({
        id: n.id,
        name: n.data.name.trim(),
        type: n.data.type,
        instances: n.data.instances,
        serviceTimeMs: n.data.serviceTimeMs,
        monthlyCostPerInstance: n.data.monthlyCostPerInstance,
        ...(n.data.type === 'database' && n.data.writeFraction !== undefined ? { writeFraction: n.data.writeFraction } : {}),
      })),
      links: doc.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        callsPerRequest: e.data?.callsPerRequest ?? 1,
        async: e.data?.async ?? false,
      })),
    },
    entryPointId: doc.entryPointId,
    trafficRps: doc.trafficRps,
    safeUtilization: doc.safeUtilization,
  };
}

/** Verdadeiro se já existe caminho de `from` até `to`. Usado para impedir ciclos ao conectar. */
export function reaches(edges: readonly Pick<LinkEdge, 'source' | 'target'>[], from: string, to: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source);
    if (list) list.push(e.target);
    else adj.set(e.source, [e.target]);
  }
  const seen = new Set<string>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}

export type ConnectionProblem = 'self' | 'duplicate' | 'cycle';

export function connectionProblem(
  edges: readonly Pick<LinkEdge, 'source' | 'target'>[],
  source: string,
  target: string,
): ConnectionProblem | null {
  if (source === target) return 'self';
  if (edges.some((e) => e.source === source && e.target === target)) return 'duplicate';
  if (reaches(edges, target, source)) return 'cycle';
  return null;
}
