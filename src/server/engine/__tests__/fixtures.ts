import type { ArchitectureGraph, ComponentSpec, ComponentType, LinkSpec } from '../types.js';

export function component(
  id: string,
  type: ComponentType,
  instances: number,
  serviceTimeMs: number,
  monthlyCostPerInstance = 0,
  writeFraction?: number,
): ComponentSpec {
  return { id, name: id, type, instances, serviceTimeMs, monthlyCostPerInstance, ...(writeFraction !== undefined ? { writeFraction } : {}) };
}

export function link(source: string, target: string, callsPerRequest = 1, async = false): LinkSpec {
  return { source, target, callsPerRequest, async };
}

/**
 * E-commerce de referência, com valores conferidos à mão nos testes.
 *
 *   lb → app → cache
 *            → db (0,4)
 *            → pagamento externo (0,1)
 *            ⇢ fila (0,2, assíncrona) → worker → db (2)
 *
 * Demanda por instância (visitas × S / c):
 *   lb 0,001 · app 0,005 · cache 0,001 · fila 0,0001 · worker 0,003
 *   db (3 instâncias, 20% de escritas por padrão, 0,8 visita):
 *     primário 0,8 × 0,2 × 0,010 = 0,0016 · réplicas 0,8 × 0,8 × 0,010 / 2 = 0,0032
 * Gargalo: app. Capacidade máxima: 1 / 0,005 = 200 req/s. Segura (80%): 160 req/s.
 */
export function ecommerce(): ArchitectureGraph {
  return {
    components: [
      component('lb', 'load_balancer', 1, 1, 100),
      component('app', 'app', 4, 20, 450),
      component('cache', 'cache', 1, 1, 350),
      component('db', 'database', 3, 10, 1800),
      component('pay', 'external', 1, 200, 0),
      component('queue', 'queue', 1, 0.5, 50),
      component('worker', 'worker', 2, 30, 300),
    ],
    links: [
      link('lb', 'app'),
      link('app', 'cache'),
      link('app', 'db', 0.4),
      link('app', 'pay', 0.1),
      link('app', 'queue', 0.2, true),
      link('queue', 'worker'),
      link('worker', 'db', 2),
    ],
  };
}

/** Erlang C pela fórmula direta (somatório com fatoriais), independente da implementação. */
export function erlangCDirect(c: number, a: number): number {
  let sum = 0;
  let term = 1;
  for (let k = 0; k < c; k++) {
    if (k > 0) term *= a / k;
    sum += term;
  }
  const top = ((term * a) / c) * (c / (c - a)); // a^c / c! × c / (c − a)
  return top / (sum + top);
}

/** Tempo de resposta M/M/c em ms, pela fórmula direta. */
export function mmcResponseMs(lambda: number, serviceMs: number, c: number): number {
  const S = serviceMs / 1000;
  const a = lambda * S;
  return (S + (erlangCDirect(c, a) * S) / (c - a)) * 1000;
}
