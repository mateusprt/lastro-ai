import { describe, expect, it } from 'vitest';
import { GraphValidator } from '../GraphValidator.js';
import { SimulationEngine } from '../SimulationEngine.js';
import type { ArchitectureGraph, ComponentResult, ComponentSpec, SimulationResult } from '../types.js';
import { component, link, mmcResponseMs } from './fixtures.js';

const engine = new SimulationEngine();

function run(graph: ArchitectureGraph, trafficRps: number, entryPointId = 'api'): SimulationResult {
  return engine.run({ graph, entryPointId, trafficRps, safeUtilization: 0.8 });
}

function get(r: SimulationResult, id: string): ComponentResult {
  return r.components.find((c) => c.id === id)!;
}

/** API com folga de sobra, para isolar o componente estudado. */
const roomyApi = () => component('api', 'app', 100, 1);

describe('Modelagem avançada: autoscaling (valores conferidos à mão)', () => {
  // Aplicação de 20 ms, mínimo 2, máximo 10, alvo de 60% de ocupação, R$ 100 por instância.
  const graph = (): ArchitectureGraph => ({
    components: [{ ...component('api', 'app', 2, 20, 100), autoscaling: { maxInstances: 10, targetUtilization: 0.6 } }],
    links: [],
  });

  it('liga ⌈carga ÷ alvo⌉ instâncias e cobra só as ativas', () => {
    const c = get(run(graph(), 100), 'api'); // a = 100 × 0,020 = 2 → 2 / 0,6 = 3,33 → 4
    expect(c.instances).toBe(4);
    expect(c.autoscaling!.activeInstances).toBe(4);
    expect(c.utilization).toBeCloseTo(0.5, 9);
    expect(c.responseTimeMs).toBeCloseTo(mmcResponseMs(100, 20, 4), 9);
    expect(c.monthlyCost).toBe(400);
    expect(c.autoscaling!.atMax).toBe(false);
  });

  it('sem carga fica no mínimo', () => {
    const c = get(run(graph(), 0), 'api');
    expect(c.instances).toBe(2);
    expect(c.monthlyCost).toBe(200);
  });

  it('a capacidade é a do máximo de instâncias', () => {
    const r = run(graph(), 100);
    expect(get(r, 'api').maxEntryRps).toBeCloseTo(500, 9); // 10 / 0,020
    expect(r.system.safeCapacityRps).toBeCloseTo(400, 9);
  });

  it('no máximo: sinaliza e recomenda subir o máximo', () => {
    const c = get(run(graph(), 450), 'api'); // a = 9; pede 15, para em 10 → 90%
    expect(c.instances).toBe(10);
    expect(c.utilization).toBeCloseTo(0.9, 9);
    expect(c.status).toBe('critical');
    expect(c.autoscaling!.atMax).toBe(true);
    expect(c.requiredInstances).toBe(12); // 9 / 0,8 = 11,25
    expect(c.additionalInstances).toBe(2);
    expect(c.autoscaling!.requiredMaxInstances).toBe(12);
  });

  it('a curva usa as instâncias que o autoscaling ligaria em cada tráfego', () => {
    const engine10 = new SimulationEngine({ curve: { points: 11, maxCapacityFraction: 0.5 } }); // pontos a cada 25 req/s
    const r = engine10.run({ graph: graph(), entryPointId: 'api', trafficRps: 100, safeUtilization: 0.8 });
    const p = r.curve.find((x) => Math.abs(x.trafficRps - 100) < 1e-9)!;
    expect(p.responseTimeMs).toBeCloseTo(r.system.responseTimeMs!, 9);
  });

  it('autoscaling num tipo que não escala é ignorado', () => {
    const g: ArchitectureGraph = {
      components: [roomyApi(), { ...component('db', 'database', 1, 10), autoscaling: { maxInstances: 5, targetUtilization: 0.5 } }],
      links: [link('api', 'db')],
    };
    const c = get(run(g, 50), 'db');
    expect(c.instances).toBe(1);
    expect(c.autoscaling).toBeUndefined();
  });
});

describe('Modelagem avançada: cache com taxa de acerto', () => {
  const graph = (hitRate?: number): ArchitectureGraph => ({
    components: [
      roomyApi(),
      { ...component('cache', 'cache', 1, 1), ...(hitRate !== undefined ? { hitRate } : {}) },
      component('db', 'database', 1, 10),
    ],
    links: [link('api', 'cache'), link('cache', 'db')],
  });

  it('só as faltas seguem para o banco', () => {
    const r = run(graph(0.8), 100);
    const cache = get(r, 'cache');
    expect(cache.throughputRps).toBeCloseTo(100, 9);
    expect(cache.cache).toEqual({ hitRate: 0.8, hitsRps: 80, missesRps: expect.closeTo(20, 9) });
    expect(get(r, 'db').throughputRps).toBeCloseTo(20, 9);
    expect(get(r, 'db').utilization).toBeCloseTo(0.2, 9);
    expect(r.links.find((l) => l.source === 'cache')!.throughputRps).toBeCloseTo(20, 9);
  });

  it('no tempo de resposta, o banco entra só nas faltas', () => {
    const r = run(graph(0.8), 100);
    const expected = get(r, 'api').responseTimeMs! + get(r, 'cache').responseTimeMs! + 0.2 * get(r, 'db').responseTimeMs!;
    expect(r.system.responseTimeMs).toBeCloseTo(expected, 9);
  });

  it('sem taxa de acerto, tudo segue adiante como antes', () => {
    expect(get(run(graph(), 100), 'db').throughputRps).toBeCloseTo(100, 9);
    expect(get(run(graph(), 100), 'cache').cache).toBeUndefined();
  });

  it('mais acerto aumenta a capacidade: o banco deixa de ser o gargalo', () => {
    expect(run(graph(0), 0).system.maxCapacityRps).toBeCloseTo(100, 9); // banco: 1 / 0,010
    expect(run(graph(0.8), 0).system.maxCapacityRps).toBeCloseTo(500, 9); // banco: 1 / (0,2 × 0,010)
  });
});

describe('Modelagem avançada: pool de conexões do banco (valores conferidos à mão)', () => {
  // Banco de 1 instância e 10 ms; pool de 2 conexões, cada consulta prende a conexão 10 ms além da resposta do banco.
  const graph = (size = 2, extraHoldMs = 10): ArchitectureGraph => ({
    components: [roomyApi(), { ...component('db', 'database', 1, 10), connectionPool: { size, extraHoldMs } }],
    links: [link('api', 'db')],
  });

  it('conexões em uso pela Lei de Little e espera por conexão (M/M/2)', () => {
    const c = get(run(graph(), 50), 'db');
    // Banco: ρ = 0,5, R = 10 / 0,5 = 20 ms. H = 30 ms. Em uso: 50 × 0,030 = 1,5.
    expect(c.connectionPool!.inUse).toBeCloseTo(1.5, 9);
    expect(c.connectionPool!.utilization).toBeCloseTo(0.75, 9);
    // Erlang C(2; 1,5) = 4,5 / 7. Wq = C × H / (2 − 1,5).
    const wq = ((4.5 / 7) * 30) / 0.5;
    expect(c.connectionPool!.waitTimeMs).toBeCloseTo(wq, 9);
    expect(c.responseTimeMs).toBeCloseTo(20 + wq, 9);
    expect(c.utilization).toBeCloseTo(0.75, 9); // a maior entre banco (50%) e pool (75%)
    expect(c.status).toBe('warning');
  });

  it('o pool esgota antes das instâncias: u(2 − u)/(1 − u) = 2 → u = 2 − √2', () => {
    const c = get(run(graph(), 50), 'db');
    expect(c.connectionPool!.maxEntryRps).toBeCloseTo(100 * (2 - Math.SQRT2), 6); // 58,58 req/s
    expect(c.maxEntryRps).toBeCloseTo(100 * (2 - Math.SQRT2), 6);
    expect(c.connectionPool!.limiting).toBe(true);
    // Limite seguro: u(2 − u)/(1 − u) = 1,6 → u = (3,6 − √6,56) / 2.
    expect(c.safeEntryRps).toBeCloseTo(100 * ((3.6 - Math.sqrt(6.56)) / 2), 6);
  });

  it('acima do limite do pool, a espera por conexão não tem fim', () => {
    const r = run(graph(), 60); // H = 25 + 10 = 35 ms; 60 × 0,035 = 2,1 conexões > 2
    expect(get(r, 'db').saturated).toBe(true);
    expect(get(r, 'db').responseTimeMs).toBeNull();
    expect(r.system.saturated).toBe(true);
    expect(get(r, 'db').connectionPool!.requiredSize).toBe(3); // 2,1 / 0,8 = 2,6
  });

  it('pool grande não muda nada', () => {
    const c = get(run(graph(1000, 0), 50), 'db');
    expect(c.connectionPool!.limiting).toBe(false);
    expect(c.responseTimeMs).toBeCloseTo(20, 9);
    expect(c.maxEntryRps).toBeCloseTo(100, 9);
  });

  it('banco saturado: o pool também, sem números infinitos no JSON', () => {
    const r = run(graph(), 120);
    const pool = get(r, 'db').connectionPool!;
    expect(pool.saturated).toBe(true);
    expect(pool.inUse).toBeNull();
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe('Modelagem avançada: limite de chamadas de serviço externo', () => {
  // API chama o gateway em 10% das requisições; o gateway aceita 5 chamadas/s.
  const graph = (rateLimitRps?: number): ArchitectureGraph => ({
    components: [roomyApi(), { ...component('pay', 'external', 1, 200), ...(rateLimitRps !== undefined ? { rateLimitRps } : {}) } as ComponentSpec],
    links: [link('api', 'pay', 0.1)],
  });

  it('a ocupação é chamadas ÷ limite', () => {
    const c = get(run(graph(5), 40), 'pay'); // 4 chamadas/s
    expect(c.utilization).toBeCloseTo(0.8, 9);
    expect(c.status).toBe('critical');
    expect(c.responseTimeMs).toBe(200);
    expect(c.rateLimit!.requiredLimitRps).toBeCloseTo(5, 9); // 4 / 0,8
  });

  it('o serviço externo passa a ser o gargalo', () => {
    const r = run(graph(5), 10);
    expect(r.system.bottleneckId).toBe('pay');
    expect(r.system.maxCapacityRps).toBeCloseTo(50, 9); // 5 / 0,1
    expect(r.system.safeCapacityRps).toBeCloseTo(40, 9);
  });

  it('no limite o fornecedor recusa: sobrecarregado', () => {
    const r = run(graph(5), 50);
    expect(get(r, 'pay').saturated).toBe(true);
    expect(r.system.saturated).toBe(true);
    expect(r.system.responseTimeMs).toBeNull();
  });

  it('sem limite, continua sem fila e fora do gargalo', () => {
    const r = run(graph(), 10);
    expect(r.system.bottleneckId).toBe('api');
    expect(get(r, 'pay').utilization).toBe(0);
  });
});

describe('Modelagem avançada: validação', () => {
  const validator = new GraphValidator();
  const codes = (c: ComponentSpec) =>
    validator.collectIssues({ graph: { components: [c], links: [] }, entryPointId: c.id, trafficRps: 10, safeUtilization: 0.8 }).map((i) => i.code);

  it('aceita valores coerentes', () => {
    expect(codes({ ...component('a', 'app', 2, 10), autoscaling: { maxInstances: 2, targetUtilization: 0.7 } })).toEqual([]);
    expect(codes({ ...component('c', 'cache', 1, 1), hitRate: 1 })).toEqual([]);
    expect(codes({ ...component('d', 'database', 1, 10), connectionPool: { size: 1, extraHoldMs: 0 } })).toEqual([]);
    expect(codes({ ...component('e', 'external', 1, 100), rateLimitRps: 0.5 })).toEqual([]);
  });

  it('recusa valores fora do lugar', () => {
    expect(codes({ ...component('a', 'app', 3, 10), autoscaling: { maxInstances: 2, targetUtilization: 0.7 } })).toContain('INVALID_AUTOSCALING');
    expect(codes({ ...component('a', 'app', 1, 10), autoscaling: { maxInstances: 4, targetUtilization: 1 } })).toContain('INVALID_AUTOSCALING');
    expect(codes({ ...component('c', 'cache', 1, 1), hitRate: 1.2 })).toContain('INVALID_HIT_RATE');
    expect(codes({ ...component('d', 'database', 1, 10), connectionPool: { size: 0, extraHoldMs: 0 } })).toContain('INVALID_CONNECTION_POOL');
    expect(codes({ ...component('d', 'database', 1, 10), connectionPool: { size: 5, extraHoldMs: -1 } })).toContain('INVALID_CONNECTION_POOL');
    expect(codes({ ...component('e', 'external', 1, 100), rateLimitRps: 0 })).toContain('INVALID_RATE_LIMIT');
  });
});
