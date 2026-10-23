import { describe, expect, it } from 'vitest';
import { GraphValidator } from '../GraphValidator.js';
import { SimulationValidationError, type ValidationIssueCode } from '../errors.js';
import type { ArchitectureGraph, SimulationInput } from '../types.js';
import { component, ecommerce, link } from './fixtures.js';

const validator = new GraphValidator();

function input(graph: ArchitectureGraph, overrides: Partial<SimulationInput> = {}): SimulationInput {
  return { graph, entryPointId: graph.components[0]?.id ?? 'x', trafficRps: 100, safeUtilization: 0.8, ...overrides };
}

function codes(i: SimulationInput): ValidationIssueCode[] {
  return validator.collectIssues(i).map((x) => x.code);
}

describe('GraphValidator', () => {
  it('aceita o diagrama de referência', () => {
    expect(codes(input(ecommerce()))).toEqual([]);
    expect(() => validator.validate(input(ecommerce()))).not.toThrow();
  });

  it('detecta ciclo e informa o caminho', () => {
    const g: ArchitectureGraph = {
      components: [component('a', 'app', 1, 10), component('b', 'app', 1, 10), component('c', 'database', 1, 10)],
      links: [link('a', 'b'), link('b', 'c'), link('c', 'a')],
    };
    const issues = validator.collectIssues(input(g));
    const cycle = issues.find((i) => i.code === 'CYCLE');
    expect(cycle).toBeDefined();
    expect(new Set(cycle!.componentIds)).toEqual(new Set(['a', 'b', 'c']));
    expect(cycle!.message).toMatch(/→/);
  });

  it('considera ciclo mesmo quando passa por ligação assíncrona', () => {
    const g: ArchitectureGraph = {
      components: [component('a', 'app', 1, 10), component('q', 'queue', 1, 1)],
      links: [link('a', 'q', 1, true), link('q', 'a')],
    };
    expect(codes(input(g))).toContain('CYCLE');
  });

  it('aceita grafo em diamante (não é ciclo)', () => {
    const g: ArchitectureGraph = {
      components: [component('a', 'app', 1, 1), component('b', 'app', 1, 1), component('c', 'app', 1, 1), component('d', 'database', 1, 1)],
      links: [link('a', 'b'), link('a', 'c'), link('b', 'd'), link('c', 'd')],
    };
    expect(codes(input(g))).toEqual([]);
  });

  it('detecta referências inválidas, autoligação e ligação duplicada', () => {
    const g: ArchitectureGraph = {
      components: [component('a', 'app', 1, 10), component('b', 'database', 1, 10)],
      links: [link('a', 'x'), link('y', 'b'), link('a', 'a'), link('a', 'b'), link('a', 'b', 0.5)],
    };
    const c = codes(input(g));
    expect(c).toContain('UNKNOWN_LINK_TARGET');
    expect(c).toContain('UNKNOWN_LINK_SOURCE');
    expect(c).toContain('SELF_LINK');
    expect(c).toContain('DUPLICATE_LINK');
  });

  it('detecta ids duplicados e ponto de entrada inexistente', () => {
    const g: ArchitectureGraph = { components: [component('a', 'app', 1, 10), component('a', 'app', 1, 10)], links: [] };
    const c = codes(input(g, { entryPointId: 'zzz' }));
    expect(c).toContain('DUPLICATE_COMPONENT_ID');
    expect(c).toContain('UNKNOWN_ENTRY_POINT');
  });

  it('valida instâncias, tempo de serviço, custo e peso', () => {
    const g: ArchitectureGraph = {
      components: [
        component('a', 'app', 0, 10),
        component('b', 'app', 2.5, 10),
        component('c', 'app', 1, 0),
        component('d', 'app', 1, 10, -1),
        component('e', 'external', 1, 0), // latência 0 é permitida para externo
      ],
      links: [link('a', 'b', -0.1)],
    };
    const issues = validator.collectIssues(input(g));
    const byCode = (code: ValidationIssueCode) => issues.filter((i) => i.code === code).flatMap((i) => i.componentIds ?? []);
    expect(byCode('INVALID_INSTANCES').sort()).toEqual(['a', 'b']);
    expect(byCode('INVALID_SERVICE_TIME')).toEqual(['c']);
    expect(byCode('INVALID_COST')).toEqual(['d']);
    expect(issues.some((i) => i.code === 'INVALID_LINK_WEIGHT')).toBe(true);
  });

  it('valida o percentual de escritas do banco', () => {
    const ok = (writeFraction: number) => input({ components: [component('db', 'database', 2, 10, 0, writeFraction)], links: [] });
    expect(codes(ok(0))).toEqual([]);
    expect(codes(ok(1))).toEqual([]);
    expect(codes(ok(-0.1))).toContain('INVALID_WRITE_FRACTION');
    expect(codes(ok(1.5))).toContain('INVALID_WRITE_FRACTION');
    expect(codes(ok(NaN))).toContain('INVALID_WRITE_FRACTION');
  });

  it('valida tráfego e limite seguro', () => {
    expect(codes(input(ecommerce(), { trafficRps: -1 }))).toContain('INVALID_TRAFFIC');
    expect(codes(input(ecommerce(), { trafficRps: Number.NaN }))).toContain('INVALID_TRAFFIC');
    expect(codes(input(ecommerce(), { safeUtilization: 1 }))).toContain('INVALID_SAFE_UTILIZATION');
    expect(codes(input(ecommerce(), { safeUtilization: 0 }))).toContain('INVALID_SAFE_UTILIZATION');
    expect(codes(input(ecommerce(), { trafficRps: 0 }))).toEqual([]);
  });

  it('respeita os limites de tamanho', () => {
    const small = new GraphValidator({ maxComponents: 2, maxLinks: 1, maxInstances: 10, maxServiceTimeMs: 1000, maxTrafficRps: 10 });
    const c = small.collectIssues(input(ecommerce())).map((i) => i.code);
    expect(c).toContain('TOO_MANY_COMPONENTS');
    expect(c).toContain('TOO_MANY_LINKS');
    expect(c).toContain('INVALID_TRAFFIC');
  });

  it('rejeita diagrama vazio', () => {
    expect(codes({ graph: { components: [], links: [] }, entryPointId: 'a', trafficRps: 1, safeUtilization: 0.8 })).toContain('EMPTY_GRAPH');
  });

  it('lança SimulationValidationError com todos os problemas', () => {
    const g: ArchitectureGraph = { components: [component('a', 'app', 0, 0)], links: [] };
    try {
      validator.validate(input(g));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SimulationValidationError);
      expect((e as SimulationValidationError).issues.length).toBe(2);
    }
  });
});
