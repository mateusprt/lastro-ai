import type { ArchitectureGraph, LinkSpec } from './types.js';

export interface TrafficPropagation {
  /** Ordem topológica de todos os componentes do grafo. */
  order: string[];
  /** Visitas por requisição de entrada (geram carga). */
  visits: Map<string, number>;
  /** Visitas síncronas por requisição de entrada (somam no tempo de resposta). */
  syncVisits: Map<string, number>;
  /** Componentes com caminho a partir do ponto de partida. */
  reachable: Set<string>;
}

/**
 * Propaga o tráfego pelo grafo (que deve ser acíclico, ver GraphValidator).
 *
 * Para cada componente, em ordem topológica:
 *   visitas[destino]   += visitas[origem]   × chamadas por requisição
 *   síncronas[destino] += síncronas[origem] × chamadas por requisição  (só ligações síncronas)
 *
 * Uma ligação assíncrona gera carga no destino e em tudo o que vem depois dele,
 * mas nada abaixo dela entra no caminho síncrono da requisição de entrada.
 */
export class TrafficPropagator {
  readonly order: string[];
  private readonly outgoing: Map<string, LinkSpec[]>;

  constructor(graph: ArchitectureGraph) {
    this.outgoing = new Map(graph.components.map((c) => [c.id, [] as LinkSpec[]]));
    for (const l of graph.links) this.outgoing.get(l.source)?.push(l);
    this.order = topologicalOrder(
      graph.components.map((c) => c.id),
      graph.links,
    );
  }

  /** Ligações que saem de um componente. */
  linksFrom(id: string): readonly LinkSpec[] {
    return this.outgoing.get(id) ?? [];
  }

  /**
   * Propaga uma requisição que entra em `startId`. Usado tanto para o ponto
   * de entrada do sistema quanto para medir o trabalho disparado por uma
   * ligação assíncrona (o destino dela vira o ponto de partida do "job").
   */
  propagate(startId: string): TrafficPropagation {
    const visits = new Map<string, number>(this.order.map((id) => [id, 0]));
    const syncVisits = new Map<string, number>(this.order.map((id) => [id, 0]));
    const reachable = new Set<string>([startId]);
    visits.set(startId, 1);
    syncVisits.set(startId, 1);

    for (const id of this.order) {
      if (!reachable.has(id)) continue;
      const v = visits.get(id)!;
      const sv = syncVisits.get(id)!;
      for (const l of this.linksFrom(id)) {
        reachable.add(l.target);
        visits.set(l.target, visits.get(l.target)! + v * l.callsPerRequest);
        if (!l.async) {
          syncVisits.set(l.target, syncVisits.get(l.target)! + sv * l.callsPerRequest);
        }
      }
    }

    return { order: this.order, visits, syncVisits, reachable };
  }
}

/** Algoritmo de Kahn. Mantém a ordem original entre componentes independentes. */
function topologicalOrder(ids: string[], links: readonly LinkSpec[]): string[] {
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of links) {
    adj.get(l.source)!.push(l.target);
    indegree.set(l.target, indegree.get(l.target)! + 1);
  }
  const queue = ids.filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    order.push(id);
    for (const to of adj.get(id)!) {
      const d = indegree.get(to)! - 1;
      indegree.set(to, d);
      if (d === 0) queue.push(to);
    }
  }
  if (order.length !== ids.length) {
    // Não deveria acontecer: o GraphValidator rejeita ciclos antes.
    throw new Error('O grafo tem ciclo; valide-o com GraphValidator antes de propagar o tráfego.');
  }
  return order;
}
