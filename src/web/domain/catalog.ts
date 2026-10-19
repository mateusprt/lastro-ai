import type { ComponentType } from '../../shared/simulation.js';

export interface ComponentKind {
  type: ComponentType;
  label: string;
  /** Uma linha explicando para que serve, exibida na paleta. */
  hint: string;
  defaults: {
    instances: number;
    serviceTimeMs: number;
    monthlyCostPerInstance: number;
  };
}

/**
 * Tipos de componente e valores iniciais. Os padrões existem para reduzir o
 * atrito de entrada (risco "Atrito de entrada" do TDD): o usuário começa com
 * números plausíveis e ajusta depois.
 */
export const CATALOG: readonly ComponentKind[] = [
  {
    type: 'load_balancer',
    label: 'Balanceador',
    hint: 'Distribui as requisições entre as instâncias',
    defaults: { instances: 1, serviceTimeMs: 1, monthlyCostPerInstance: 120 },
  },
  {
    type: 'app',
    label: 'Aplicação',
    hint: 'API ou serviço que atende o usuário',
    defaults: { instances: 2, serviceTimeMs: 20, monthlyCostPerInstance: 450 },
  },
  {
    type: 'cache',
    label: 'Cache',
    hint: 'Redis, Memcached',
    defaults: { instances: 1, serviceTimeMs: 1, monthlyCostPerInstance: 350 },
  },
  {
    type: 'database',
    label: 'Banco de dados',
    hint: 'Postgres, MySQL, MongoDB',
    defaults: { instances: 1, serviceTimeMs: 10, monthlyCostPerInstance: 1800 },
  },
  {
    type: 'queue',
    label: 'Fila',
    hint: 'SQS, RabbitMQ, Kafka',
    defaults: { instances: 1, serviceTimeMs: 0.5, monthlyCostPerInstance: 80 },
  },
  {
    type: 'worker',
    label: 'Worker',
    hint: 'Processa trabalho em segundo plano',
    defaults: { instances: 2, serviceTimeMs: 50, monthlyCostPerInstance: 300 },
  },
  {
    type: 'external',
    label: 'Serviço externo',
    hint: 'Gateway de pagamento, API de terceiros',
    defaults: { instances: 1, serviceTimeMs: 200, monthlyCostPerInstance: 0 },
  },
];

const BY_TYPE = new Map(CATALOG.map((k) => [k.type, k]));

export function kindOf(type: ComponentType): ComponentKind {
  return BY_TYPE.get(type) ?? CATALOG[1]!;
}
