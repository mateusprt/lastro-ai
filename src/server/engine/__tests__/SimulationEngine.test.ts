import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SimulationEngine } from '../SimulationEngine.js';
import { SimulationValidationError } from '../errors.js';
import { COMPONENT_TYPES, type ArchitectureGraph, type ComponentResult, type SimulationResult } from '../types.js';
import { component, ecommerce, link, mmcResponseMs } from './fixtures.js';

const engine = new SimulationEngine();

function run(graph: ArchitectureGraph, trafficRps: number, safeUtilization = 0.8, entryPointId = 'lb'): SimulationResult {
  return engine.run({ graph, entryPointId, trafficRps, safeUtilization });
}

function byId(r: SimulationResult): Record<string, ComponentResult> {
  return Object.fromEntries(r.components.map((c) => [c.id, c]));
}

describe('SimulationEngine: diagrama de referência a 100 req/s (valores conferidos à mão)', () => {
  const r = run(ecommerce(), 100);
  const c = byId(r);

  it('vazão e utilização por componente (U = X × S / c)', () => {
    expect(c.lb!.throughputRps).toBeCloseTo(100, 9);
    expect(c.lb!.utilization).toBeCloseTo(0.1, 9); // 100 × 0,001 / 1
    expect(c.app!.utilization).toBeCloseTo(0.5, 9); // 100 × 0,020 / 4
    expect(c.cache!.utilization).toBeCloseTo(0.1, 9);
    expect(c.db!.throughputRps).toBeCloseTo(80, 9); // 0,8 visita
    expect(c.db!.utilization).toBeCloseTo(0.4, 9); // 80 × 0,010 / 2
    expect(c.worker!.utilization).toBeCloseTo(0.3, 9); // 20 × 0,030 / 2
    expect(c.pay!.utilization).toBe(0);
  });

  it('tempo de resposta por componente (M/M/1 e M/M/c)', () => {
    expect(c.lb!.responseTimeMs).toBeCloseTo(1 / 0.9, 9); // S / (1 − ρ)
    expect(c.app!.responseTimeMs).toBeCloseTo(mmcResponseMs(100, 20, 4), 9);
    expect(c.db!.responseTimeMs).toBeCloseTo(mmcResponseMs(80, 10, 2), 9);
    expect(c.pay!.responseTimeMs).toBe(200); // latência fixa, sem fila
  });

  it('tempo de resposta de ponta a ponta soma só o caminho síncrono', () => {
    const expected =
      c.lb!.responseTimeMs! + c.app!.responseTimeMs! + c.cache!.responseTimeMs! + 0.4 * c.db!.responseTimeMs! + 0.1 * 200;
    expect(r.system.responseTimeMs).toBeCloseTo(expected, 9);
  });

  it('atraso em segundo plano: fila → worker → banco (2 chamadas)', () => {
    expect(r.system.hasBackgroundWork).toBe(true);
    const expected = c.queue!.responseTimeMs! + c.worker!.responseTimeMs! + 2 * c.db!.responseTimeMs!;
    expect(r.system.backgroundDelayMs).toBeCloseTo(expected, 9);
  });

  it('gargalo e capacidades', () => {
    expect(r.system.bottleneckId).toBe('app');
    expect(r.system.maxCapacityRps).toBeCloseTo(200, 9); // 4 / 0,020
    expect(r.system.safeCapacityRps).toBeCloseTo(160, 9);
    expect(c.db!.maxEntryRps).toBeCloseTo(250, 9); // 2 / (0,8 × 0,010)
  });

  it('Lei de Little no sistema: N = λ × R', () => {
    expect(r.system.requestsInFlight).toBeCloseTo(100 * (r.system.responseTimeMs! / 1000), 12);
  });

  it('custos e status', () => {
    expect(r.system.monthlyCost).toBe(6500);
    expect(r.system.extraMonthlyCost).toBe(0);
    expect(r.components.every((x) => x.status === 'ok')).toBe(true);
    expect(r.system.saturated).toBe(false);
  });

  it('vazão nas ligações', () => {
    const l = Object.fromEntries(r.links.map((x) => [`${x.source}>${x.target}`, x.throughputRps]));
    expect(l['app>db']).toBeCloseTo(40, 9);
    expect(l['worker>db']).toBeCloseTo(40, 9);
    expect(l['app>queue']).toBeCloseTo(20, 9);
  });
});

describe('SimulationEngine: cenários', () => {
  it('atenção a partir de 75% do limite seguro', () => {
    const c = byId(run(ecommerce(), 150)); // app a 75%; 0,75 ≥ 0,8 × 0,75
    expect(c.app!.status).toBe('warning');
    expect(c.db!.status).toBe('ok');
  });

  it('crítico exatamente no limite seguro', () => {
    const r = run(ecommerce(), 160);
    expect(byId(r).app!.utilization).toBeCloseTo(0.8, 9);
    expect(byId(r).app!.status).toBe('critical');
  });

  it('saturação: tempos ilimitados, instâncias e custo para voltar ao limite seguro', () => {
    const r = run(ecommerce(), 300);
    const c = byId(r);
    expect(c.app!.saturated).toBe(true);
    expect(c.app!.responseTimeMs).toBeNull();
    expect(r.system.saturated).toBe(true);
    expect(r.system.responseTimeMs).toBeNull();
    expect(r.system.requestsInFlight).toBeNull();
    expect(r.system.backgroundDelayMs).toBeNull(); // banco saturado: 240 × 0,010 = 2,4 > 2

    expect(c.app!.requiredInstances).toBe(8); // 6 / 0,8 = 7,5
    expect(c.db!.requiredInstances).toBe(3); // 2,4 / 0,8 = 3
    expect(c.worker!.requiredInstances).toBe(3); // 1,8 / 0,8 = 2,25
    expect(c.lb!.requiredInstances).toBe(1);
    expect(r.system.extraMonthlyCost).toBe(4 * 450 + 1800 + 300);
  });

  it('chamadas assíncronas não alteram o tempo de resposta do usuário', () => {
    const base = ecommerce();
    const removed = ['queue', 'worker'];
    base.links = base.links.filter((l) => !removed.includes(l.source) && !removed.includes(l.target));
    base.components = base.components.filter((x) => !removed.includes(x.id));
    // Sem o ramo assíncrono o banco recebe menos carga; para isolar o efeito,
    // compara com o banco na mesma utilização ajustando o peso direto do app.
    base.links = base.links.map((l) => (l.source === 'app' && l.target === 'db' ? { ...l, callsPerRequest: 0.8 } : l));
    const withoutAsync = run(base, 100);

    const withAsync = run(ecommerce(), 100);
    const dbSync = byId(withAsync).db!.responseTimeMs!;
    // Mesma carga no banco nos dois casos (0,8 visita); só muda quanto dela é síncrona.
    expect(byId(withoutAsync).db!.responseTimeMs).toBeCloseTo(dbSync, 9);
    expect(withoutAsync.system.responseTimeMs! - withAsync.system.responseTimeMs!).toBeCloseTo(0.4 * dbSync, 9);
    expect(withoutAsync.system.hasBackgroundWork).toBe(false);
    expect(withoutAsync.system.backgroundDelayMs).toBe(0);
  });

  it('tráfego zero: sem fila, tempos iguais ao serviço, capacidades definidas', () => {
    const r = run(ecommerce(), 0);
    const c = byId(r);
    expect(c.app!.utilization).toBe(0);
    expect(c.app!.responseTimeMs).toBe(20);
    expect(r.system.responseTimeMs).toBeCloseTo(1 + 20 + 1 + 0.4 * 10 + 0.1 * 200, 9);
    expect(r.system.bottleneckId).toBe('app');
    expect(r.system.maxCapacityRps).toBeCloseTo(200, 9);
    expect(r.system.requestsInFlight).toBe(0);
  });

  it('componente isolado não recebe carga nem entra nos resultados do sistema', () => {
    const g = ecommerce();
    g.components.push(component('orphan', 'database', 1, 1000, 999));
    const r = run(g, 100);
    const o = byId(r).orphan!;
    expect(o.reachable).toBe(false);
    expect(o.utilization).toBe(0);
    expect(r.system.bottleneckId).toBe('app');
    expect(r.system.responseTimeMs).toBeCloseTo(run(ecommerce(), 100).system.responseTimeMs!, 9);
    // O custo dele continua contando: a instância existe.
    expect(r.system.monthlyCost).toBe(6500 + 999);
  });

  it('só serviços externos: capacidade ilimitada', () => {
    const g: ArchitectureGraph = { components: [component('ext', 'external', 1, 150)], links: [] };
    const r = run(g, 1000, 0.8, 'ext');
    expect(r.system.bottleneckId).toBeNull();
    expect(r.system.maxCapacityRps).toBeNull();
    expect(r.system.safeCapacityRps).toBeNull();
    expect(r.system.responseTimeMs).toBe(150);
    expect(r.curve.every((p) => p.responseTimeMs === 150)).toBe(true);
  });

  it('jobs assíncronos aninhados somam no atraso em segundo plano', () => {
    const g: ArchitectureGraph = {
      components: [component('api', 'app', 1, 1), component('q1', 'queue', 1, 1), component('w1', 'worker', 1, 10), component('q2', 'queue', 1, 1), component('w2', 'worker', 1, 20)],
      links: [link('api', 'q1', 1, true), link('q1', 'w1'), link('w1', 'q2', 1, true), link('q2', 'w2')],
    };
    const r = run(g, 0, 0.8, 'api');
    expect(r.system.responseTimeMs).toBe(1);
    expect(r.system.backgroundDelayMs).toBeCloseTo(1 + 10 + 1 + 20, 9);
  });

  it('ramos assíncronos em paralelo: vale o mais lento', () => {
    const g: ArchitectureGraph = {
      components: [component('api', 'app', 1, 1), component('fast', 'worker', 1, 5), component('slow', 'worker', 1, 50)],
      links: [link('api', 'fast', 1, true), link('api', 'slow', 1, true)],
    };
    expect(run(g, 0, 0.8, 'api').system.backgroundDelayMs).toBe(50);
  });

  it('curva de resposta: começa no tráfego zero e termina antes da saturação', () => {
    const r = run(ecommerce(), 100);
    expect(r.curve).toHaveLength(50);
    expect(r.curve[0]!.trafficRps).toBe(0);
    expect(r.curve[0]!.responseTimeMs).toBeCloseTo(run(ecommerce(), 0).system.responseTimeMs!, 9);
    expect(r.curve.at(-1)!.trafficRps).toBeCloseTo(200 * 0.98, 9);
    expect(r.curve.at(-1)!.responseTimeMs).not.toBeNull();
  });

  it('o ponto da curva no tráfego simulado coincide com o resultado do sistema', () => {
    const engine10 = new SimulationEngine({ curve: { points: 11, maxCapacityFraction: 0.5 } }); // pontos a cada 10 req/s
    const r = engine10.run({ graph: ecommerce(), entryPointId: 'lb', trafficRps: 60, safeUtilization: 0.8 });
    const p = r.curve.find((x) => Math.abs(x.trafficRps - 60) < 1e-9)!;
    expect(p.responseTimeMs).toBeCloseTo(r.system.responseTimeMs!, 9);
  });

  it('propaga erros de validação', () => {
    const g = ecommerce();
    g.links.push(link('db', 'lb'));
    expect(() => run(g, 100)).toThrow(SimulationValidationError);
  });

  it('o resultado é serializável em JSON sem perder informação', () => {
    const r = run(ecommerce(), 300);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

/** Gerador de grafos acíclicos aleatórios: ligações só de i para j > i, entrada no nó 0. */
const arbGraph = fc
  .integer({ min: 1, max: 8 })
  .chain((n) =>
    fc.record({
      components: fc.tuple(
        ...Array.from({ length: n }, (_, i) =>
          fc.record({
            id: fc.constant(`n${i}`),
            name: fc.constant(`n${i}`),
            // Entrada nunca é externa, para sempre haver algum componente com fila.
            type: i === 0 ? fc.constantFrom('load_balancer' as const, 'app' as const) : fc.constantFrom(...COMPONENT_TYPES),
            instances: fc.integer({ min: 1, max: 8 }),
            serviceTimeMs: fc.double({ min: 0.5, max: 200, noNaN: true }),
            monthlyCostPerInstance: fc.integer({ min: 0, max: 2000 }),
          }),
        ),
      ),
      links: fc
        .array(
          fc.record({
            i: fc.integer({ min: 0, max: Math.max(0, n - 2) }),
            d: fc.integer({ min: 1, max: Math.max(1, n - 1) }),
            callsPerRequest: fc.double({ min: 0, max: 3, noNaN: true }),
            async: fc.boolean(),
          }),
          { maxLength: n * 2 },
        )
        .map((ls) => {
          const seen = new Set<string>();
          return ls
            .map((l) => ({ source: `n${l.i}`, target: `n${Math.min(n - 1, l.i + l.d)}`, callsPerRequest: l.callsPerRequest, async: l.async }))
            .filter((l) => l.source !== l.target && !seen.has(`${l.source}>${l.target}`) && seen.add(`${l.source}>${l.target}`));
        }),
    }),
  ) as fc.Arbitrary<ArchitectureGraph>;

describe('SimulationEngine: propriedades em grafos aleatórios', () => {
  const thr = 0.8;
  const opts = { numRuns: 300 };

  it('U = X × S / c e X = λ × visitas em todo componente com fila', () => {
    fc.assert(
      fc.property(arbGraph, fc.double({ min: 0, max: 0.95, noNaN: true }), (g, f) => {
        const max = run(g, 0, thr, 'n0').system.maxCapacityRps!;
        const r = run(g, f * max, thr, 'n0');
        for (const c of r.components) {
          const spec = g.components.find((x) => x.id === c.id)!;
          expect(c.throughputRps).toBeCloseTo(r.input.trafficRps * c.visits, 6);
          if (spec.type !== 'external') {
            expect(c.utilization).toBeCloseTo((c.throughputRps * spec.serviceTimeMs) / 1000 / spec.instances, 9);
          }
        }
      }),
      opts,
    );
  });

  it('na capacidade segura, o componente mais carregado fica exatamente no limite', () => {
    fc.assert(
      fc.property(arbGraph, (g) => {
        const safe = run(g, 0, thr, 'n0').system.safeCapacityRps!;
        const r = run(g, safe, thr, 'n0');
        const maxU = Math.max(...r.components.filter((c) => c.type !== 'external').map((c) => c.utilization));
        expect(maxU).toBeCloseTo(thr, 9);
        expect(byId(r)[r.system.bottleneckId!]!.utilization).toBeCloseTo(thr, 9);
      }),
      opts,
    );
  });

  it('tempo de resposta nunca é menor que a soma dos tempos de serviço síncronos', () => {
    fc.assert(
      fc.property(arbGraph, fc.double({ min: 0, max: 0.99, noNaN: true }), (g, f) => {
        const max = run(g, 0, thr, 'n0').system.maxCapacityRps!;
        const r = run(g, f * max, thr, 'n0');
        const floor = r.components.reduce((a, c) => a + c.syncVisits * g.components.find((x) => x.id === c.id)!.serviceTimeMs, 0);
        expect(r.system.responseTimeMs!).toBeGreaterThanOrEqual(floor * (1 - 1e-12));
      }),
      opts,
    );
  });

  it('a curva de resposta é crescente e finita', () => {
    fc.assert(
      fc.property(arbGraph, (g) => {
        const r = run(g, 0, thr, 'n0');
        for (let i = 1; i < r.curve.length; i++) {
          expect(r.curve[i]!.responseTimeMs).not.toBeNull();
          expect(r.curve[i]!.responseTimeMs!).toBeGreaterThanOrEqual(r.curve[i - 1]!.responseTimeMs! * (1 - 1e-12));
        }
      }),
      opts,
    );
  });

  it('as instâncias recomendadas deixam todo componente dentro do limite seguro', () => {
    fc.assert(
      fc.property(arbGraph, fc.double({ min: 0, max: 4, noNaN: true }), (g, f) => {
        const max = run(g, 0, thr, 'n0').system.maxCapacityRps!;
        const r = run(g, f * max, thr, 'n0');
        const resized: ArchitectureGraph = {
          ...g,
          components: g.components.map((s) => ({ ...s, instances: byId(r)[s.id]!.requiredInstances })),
        };
        const after = run(resized, r.input.trafficRps, thr, 'n0');
        for (const c of after.components) expect(c.utilization).toBeLessThanOrEqual(thr * (1 + 1e-9));
        expect(after.system.saturated).toBe(false);
        expect(after.system.extraMonthlyCost).toBe(0);
      }),
      opts,
    );
  });

  it('acrescentar um ramo assíncrono não muda o tempo de resposta do usuário', () => {
    fc.assert(
      fc.property(arbGraph, fc.double({ min: 0, max: 0.9, noNaN: true }), (g, f) => {
        const max = run(g, 0, thr, 'n0').system.maxCapacityRps!;
        const before = run(g, f * max, thr, 'n0');
        const extended: ArchitectureGraph = {
          components: [...g.components, component('bg', 'worker', 1, 10_000)],
          links: [...g.links, link('n0', 'bg', 1, true)],
        };
        const after = run(extended, f * max, thr, 'n0');
        if (after.system.responseTimeMs === null) return; // bg pode saturar e isso é esperado
        expect(after.system.responseTimeMs).toBeCloseTo(before.system.responseTimeMs!, 9);
        expect(after.system.hasBackgroundWork).toBe(true);
      }),
      opts,
    );
  });
});
