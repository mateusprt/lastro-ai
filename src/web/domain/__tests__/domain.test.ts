import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../../server/engine/index.js';
import { diagnose } from '../diagnosis.js';
import { formatMs, formatNumber, formatPercent, formatRps, parseDecimal, toInputText } from '../format.js';
import { connectionProblem, toSimulationInput } from '../graph.js';
import { TEMPLATES, emptyDoc } from '../templates.js';

// Os testes rodam no Node; aqui o motor só gera resultados reais para conferir
// os textos. O código do frontend em si nunca importa o motor (regra de lint).
const engine = new SimulationEngine();
const ecommerce = TEMPLATES.find((t) => t.id === 'ecommerce')!;

function resultFor(traffic: number) {
  const doc = { ...ecommerce.build(), trafficRps: traffic };
  return engine.run(toSimulationInput(doc)!);
}

describe('formatação pt-BR', () => {
  it('números, tempos e percentuais', () => {
    expect(formatNumber(0.25)).toBe('0,25');
    expect(formatNumber(3.46)).toBe('3,5');
    expect(formatNumber(1250)).toBe('1.250');
    expect(formatRps(160)).toBe('160 req/s');
    expect(formatRps(null)).toBe('sem limite');
    expect(formatMs(48.7)).toBe('49 ms');
    expect(formatMs(12_500)).toBe('12,5 s');
    expect(formatPercent(0.8)).toBe('80%');
  });

  it('lê vírgula e ponto como decimal', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal('1.5')).toBe(1.5);
    expect(parseDecimal('1.250,5')).toBe(1250.5);
    expect(parseDecimal(' 20 ')).toBe(20);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(toInputText(0.4)).toBe('0,4');
  });
});

describe('montagem da requisição', () => {
  it('não envia posições e exige ponto de entrada', () => {
    const input = toSimulationInput(ecommerce.build())!;
    expect(input.entryPointId).toBe('lb');
    expect(input.graph.components.every((c) => !('position' in c))).toBe(true);
    expect(input.graph.links).toHaveLength(7);
    expect(toSimulationInput(emptyDoc())).toBeNull();
    expect(toSimulationInput({ ...ecommerce.build(), entryPointId: null })).toBeNull();
  });

  it('os modelos iniciais são simuláveis', () => {
    for (const t of TEMPLATES) {
      expect(() => engine.run(toSimulationInput(t.build())!)).not.toThrow();
    }
  });
});

describe('validação de ligações no editor', () => {
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];
  it('recusa autoligação, duplicata e ciclo', () => {
    expect(connectionProblem(edges, 'a', 'a')).toBe('self');
    expect(connectionProblem(edges, 'a', 'b')).toBe('duplicate');
    expect(connectionProblem(edges, 'c', 'a')).toBe('cycle');
    expect(connectionProblem(edges, 'a', 'c')).toBeNull();
  });
});

describe('diagnóstico', () => {
  it('folgado: gargalo e capacidade segura', () => {
    const d = diagnose(resultFor(100));
    expect(d.tone).toBe('ok');
    expect(d.headline).toBe('O gargalo é API da loja, a 50% de utilização.');
    expect(d.detail).toContain('até 160 req/s, 1,6× o tráfego atual');
  });

  it('atenção a partir de 75% do limite seguro', () => {
    expect(diagnose(resultFor(150)).tone).toBe('warning');
  });

  it('acima do limite seguro sugere as instâncias', () => {
    const d = diagnose(resultFor(170));
    expect(d.tone).toBe('critical');
    expect(d.headline).toContain('acima do limite seguro');
    expect(d.detail).toContain('Com 5 instâncias');
  });

  it('saturado lista tudo o que falta', () => {
    const d = diagnose(resultFor(300));
    expect(d.tone).toBe('critical');
    expect(d.headline).toBe('2 componentes não dão conta de 300 req/s: as filas crescem sem parar.');
    expect(d.detail).toBe(
      'O máximo hoje é 200 req/s. Para ficar abaixo de 80%, adicione 4 instâncias em API da loja, 1 instância em Processador de pedidos e 1 instância em Postgres.',
    );
  });
});
