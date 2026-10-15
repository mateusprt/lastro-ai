import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { QueueModel } from '../QueueModel.js';
import { erlangCDirect } from './fixtures.js';

describe('QueueModel.erlangC', () => {
  it('confere com valores calculados à mão', () => {
    // c = 2, a = 1: Σ = 1 + 1 = 2; topo = (1/2)·2/1 = 1; C = 1/3
    expect(QueueModel.erlangC(2, 1)).toBeCloseTo(1 / 3, 12);
    // c = 3, a = 2: Σ = 1 + 2 + 2 = 5; topo = (8/6)·3/1 = 4; C = 4/9
    expect(QueueModel.erlangC(3, 2)).toBeCloseTo(4 / 9, 12);
  });

  it('confere com a tabela clássica de Erlang C (10 servidores, 8 Erlangs ≈ 40,92%)', () => {
    expect(QueueModel.erlangC(10, 8)).toBeCloseTo(0.4092, 4);
  });

  it('em M/M/1 é igual à utilização', () => {
    for (const rho of [0.1, 0.5, 0.9, 0.99]) {
      expect(QueueModel.erlangC(1, rho)).toBeCloseTo(rho, 12);
    }
  });

  it('vale 0 sem carga e 1 com a carga no limite ou acima', () => {
    expect(QueueModel.erlangC(4, 0)).toBe(0);
    expect(QueueModel.erlangC(4, 4)).toBe(1);
    expect(QueueModel.erlangC(4, 7)).toBe(1);
  });

  it('é estável numericamente com muitos servidores', () => {
    // A fórmula direta com potências e fatoriais estoura em c = 1000.
    const c = QueueModel.erlangC(1000, 980);
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(1);
  });

  it('coincide com a fórmula direta (propriedade)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), fc.double({ min: 0.001, max: 0.999, noNaN: true }), (c, rho) => {
        const a = c * rho;
        expect(QueueModel.erlangC(c, a)).toBeCloseTo(erlangCDirect(c, a), 9);
      }),
    );
  });

  it('cresce com a carga e cai com mais servidores (propriedade)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.double({ min: 0.01, max: 0.9, noNaN: true }),
        fc.double({ min: 0.001, max: 0.09, noNaN: true }),
        (c, rho, delta) => {
          const a = c * rho;
          expect(QueueModel.erlangC(c, a + c * delta)).toBeGreaterThanOrEqual(QueueModel.erlangC(c, a));
          expect(QueueModel.erlangC(c + 1, a)).toBeLessThanOrEqual(QueueModel.erlangC(c, a));
        },
      ),
    );
  });

  it('rejeita número de servidores inválido', () => {
    expect(() => QueueModel.erlangC(0, 1)).toThrow(RangeError);
    expect(() => QueueModel.erlangC(1.5, 1)).toThrow(RangeError);
  });
});

describe('QueueModel.analyze', () => {
  it('M/M/1: R = S / (1 − ρ)', () => {
    // λ = 5 req/s, S = 100 ms → ρ = 0,5 → R = 200 ms
    const q = QueueModel.analyze(5, 0.1, 1);
    expect(q.utilization).toBeCloseTo(0.5, 12);
    expect(q.responseTimeS).toBeCloseTo(0.2, 12);
    expect(q.waitTimeS).toBeCloseTo(0.1, 12);
    expect(q.inSystem).toBeCloseTo(1, 12); // L = ρ / (1 − ρ) = 1
  });

  it('M/M/2 com λ = μ = 1: Wq = 1/3, R = 4/3 (valor de livro-texto)', () => {
    const q = QueueModel.analyze(1, 1, 2);
    expect(q.waitTimeS).toBeCloseTo(1 / 3, 12);
    expect(q.responseTimeS).toBeCloseTo(4 / 3, 12);
  });

  it('Lei de Little: Lq = λ·Wq coincide com Lq = C·ρ/(1 − ρ) (propriedade)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.double({ min: 0.01, max: 0.97, noNaN: true }),
        fc.double({ min: 0.0001, max: 2, noNaN: true }),
        (c, rho, S) => {
          const lambda = (rho * c) / S;
          const q = QueueModel.analyze(lambda, S, c);
          const lqClassic = (q.waitProbability * rho) / (1 - rho);
          expect(q.queueLength).toBeCloseTo(lqClassic, 6);
          expect(q.inSystem).toBeCloseTo(lqClassic + c * rho, 6); // L = Lq + a
        },
      ),
    );
  });

  it('satura quando a carga atinge o número de servidores', () => {
    const q = QueueModel.analyze(40, 0.1, 4); // a = 4 = c
    expect(q.saturated).toBe(true);
    expect(q.utilization).toBe(1);
    expect(q.responseTimeS).toBe(Infinity);
  });

  it('sem tráfego, o tempo de resposta é o tempo de serviço', () => {
    const q = QueueModel.analyze(0, 0.05, 3);
    expect(q.responseTimeS).toBe(0.05);
    expect(q.waitProbability).toBe(0);
    expect(q.saturated).toBe(false);
  });
});

describe('QueueModel.requiredServers', () => {
  it('arredonda para cima até caber no limite', () => {
    expect(QueueModel.requiredServers(6, 0.8)).toBe(8); // 7,5 → 8
    expect(QueueModel.requiredServers(2.4, 0.8)).toBe(3);
  });

  it('não sobe um servidor por erro de ponto flutuante', () => {
    expect(QueueModel.requiredServers(1.6, 0.8)).toBe(2); // 1,6/0,8 = 2,0000000000000004
    expect(QueueModel.requiredServers(0.3 * 3, 0.9)).toBe(1);
  });

  it('retorna 0 sem carga', () => {
    expect(QueueModel.requiredServers(0, 0.8)).toBe(0);
  });

  it('o resultado sempre fica dentro do limite e um a menos não fica (propriedade)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 5000, noNaN: true }), fc.double({ min: 0.05, max: 0.99, noNaN: true }), (a, thr) => {
        const n = QueueModel.requiredServers(a, thr);
        expect(a / n).toBeLessThanOrEqual(thr * (1 + 1e-9));
        if (n > 1) expect(a / (n - 1)).toBeGreaterThan(thr * (1 - 1e-9));
      }),
    );
  });
});
