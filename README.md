# Lastro

Editor de arquitetura e motor de simulação de capacidade. Detalhes de produto e arquitetura no TDD do projeto.

## Requisitos

- Node.js 22 ou superior

## Comandos

```bash
npm install
npm run typecheck      # TypeScript em modo estrito
npm test               # testes do motor (Vitest + fast-check)
npm run test:coverage  # cobertura do motor
```

## Estrutura

```
src/
  server/
    engine/                  motor de simulação (usado somente pela API)
      index.ts               interface pública: a API importa só daqui
      types.ts               tipos de entrada e saída
      errors.ts              SimulationValidationError e códigos de problema
      GraphValidator.ts      ciclos, referências, duplicidades e limites
      TrafficPropagator.ts   ordenação topológica, visitas totais e síncronas
      QueueModel.ts          fila M/M/c, Erlang B/C, servidores necessários
      ComponentAnalyzer.ts   vazão, utilização, tempo de resposta, custo por componente
      SystemAnalyzer.ts      gargalo, capacidades, ponta a ponta, segundo plano
      ResponseCurveBuilder.ts curva tempo de resposta × tráfego
      SimulationEngine.ts    orquestra as etapas
      __tests__/
```

## Uso do motor

```ts
import { SimulationEngine, SimulationValidationError } from './server/engine/index.js';

const engine = new SimulationEngine();

try {
  const result = engine.run({
    graph: {
      components: [
        { id: 'lb', name: 'Balanceador', type: 'load_balancer', instances: 1, serviceTimeMs: 1, monthlyCostPerInstance: 100 },
        { id: 'app', name: 'API', type: 'app', instances: 4, serviceTimeMs: 20, monthlyCostPerInstance: 450 },
        { id: 'db', name: 'Postgres', type: 'database', instances: 2, serviceTimeMs: 10, monthlyCostPerInstance: 1800 },
      ],
      links: [
        { source: 'lb', target: 'app', callsPerRequest: 1, async: false },
        { source: 'app', target: 'db', callsPerRequest: 0.4, async: false },
      ],
    },
    entryPointId: 'lb',
    trafficRps: 100,
    safeUtilization: 0.8,
  });

  result.system.bottleneckId;    // 'app'
  result.system.safeCapacityRps; // 160
} catch (e) {
  if (e instanceof SimulationValidationError) {
    e.issues; // [{ code, message, componentIds?, linkIndex? }]
  }
}
```

## Modelo

| Etapa | Fórmula |
|---|---|
| Visitas | `visitas[destino] += visitas[origem] × chamadas por requisição`, em ordem topológica. Ligações assíncronas geram carga, mas nada abaixo delas entra nas visitas síncronas. |
| Vazão | `X = λ × visitas` |
| Utilização | `U = X × S / c` |
| Tempo de resposta por visita | `R = S + C(c, a) × S / (c − a)`, com `a = X × S` e `C` = Erlang C |
| Ponta a ponta | `Σ visitas síncronas × R` |
| Segundo plano | Para cada ligação assíncrona disparada no caminho síncrono, o tempo do job no destino (com jobs aninhados). Vale o ramo mais lento. |
| Capacidade máxima | `min(c / (visitas × S))` entre os componentes com fila |
| Capacidade segura | capacidade máxima × limite seguro |
| Instâncias necessárias | `max(c, ⌈a / limite seguro⌉)` |
| Status | crítico a partir do limite seguro; atenção a partir de 75% dele |

Serviços externos são latência fixa: não têm fila, não entram no gargalo nem nas capacidades.

Tempos e capacidades `null` no resultado significam "ilimitado": tempo infinito (componente saturado) ou capacidade sem limite. Assim o resultado é JSON válido.

Erlang C é calculado pela recorrência de Erlang B, sem fatoriais, e continua estável com milhares de instâncias.

## Desempenho

Medido localmente: diagrama de 50 componentes com curva de 50 pontos roda em cerca de 2 ms (p95) com 4 instâncias por componente e 10 ms (p95) com 500. A meta do TDD é 200 ms (p95).
