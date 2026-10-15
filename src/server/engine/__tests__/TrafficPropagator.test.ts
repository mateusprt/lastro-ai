import { describe, expect, it } from 'vitest';
import { TrafficPropagator } from '../TrafficPropagator.js';
import type { ArchitectureGraph } from '../types.js';
import { component, ecommerce, link } from './fixtures.js';

describe('TrafficPropagator', () => {
  it('calcula visitas totais e síncronas do diagrama de referência', () => {
    const p = new TrafficPropagator(ecommerce()).propagate('lb');
    const v = Object.fromEntries(p.visits);
    const sv = Object.fromEntries(p.syncVisits);

    expect(v).toMatchObject({ lb: 1, app: 1, cache: 1, pay: 0.1 });
    expect(v.queue).toBeCloseTo(0.2, 12);
    expect(v.worker).toBeCloseTo(0.2, 12);
    // db: 0,4 direto do app + 0,2 × 2 pelo worker
    expect(v.db).toBeCloseTo(0.8, 12);

    // Nada depois da ligação assíncrona entra no caminho síncrono.
    expect(sv).toMatchObject({ lb: 1, app: 1, cache: 1, pay: 0.1, queue: 0, worker: 0 });
    expect(sv.db).toBeCloseTo(0.4, 12);
  });

  it('soma os caminhos de um diamante', () => {
    const g: ArchitectureGraph = {
      components: [component('a', 'app', 1, 1), component('b', 'app', 1, 1), component('c', 'app', 1, 1), component('d', 'database', 1, 1)],
      links: [link('a', 'b', 0.5), link('a', 'c', 2), link('b', 'd', 3), link('c', 'd', 1)],
    };
    const p = new TrafficPropagator(g).propagate('a');
    expect(p.visits.get('d')).toBeCloseTo(0.5 * 3 + 2 * 1, 12);
  });

  it('independe da ordem em que componentes e ligações aparecem', () => {
    const g = ecommerce();
    const shuffled: ArchitectureGraph = { components: [...g.components].reverse(), links: [...g.links].reverse() };
    const a = new TrafficPropagator(g).propagate('lb');
    const b = new TrafficPropagator(shuffled).propagate('lb');
    for (const c of g.components) {
      expect(b.visits.get(c.id)).toBeCloseTo(a.visits.get(c.id)!, 12);
      expect(b.syncVisits.get(c.id)).toBeCloseTo(a.syncVisits.get(c.id)!, 12);
    }
  });

  it('marca componentes sem caminho a partir da entrada como inalcançáveis', () => {
    const g = ecommerce();
    g.components.push(component('orphan', 'app', 1, 10));
    const p = new TrafficPropagator(g).propagate('lb');
    expect(p.reachable.has('orphan')).toBe(false);
    expect(p.visits.get('orphan')).toBe(0);
  });

  it('considera alcançável o destino de ligação com peso 0, mas sem carga', () => {
    const g: ArchitectureGraph = { components: [component('a', 'app', 1, 1), component('b', 'app', 1, 1)], links: [link('a', 'b', 0)] };
    const p = new TrafficPropagator(g).propagate('a');
    expect(p.reachable.has('b')).toBe(true);
    expect(p.visits.get('b')).toBe(0);
  });

  it('propaga a partir de qualquer componente (usado para jobs assíncronos)', () => {
    const p = new TrafficPropagator(ecommerce()).propagate('queue');
    expect(p.syncVisits.get('worker')).toBe(1);
    expect(p.syncVisits.get('db')).toBe(2);
    expect(p.reachable.has('app')).toBe(false);
  });
});
