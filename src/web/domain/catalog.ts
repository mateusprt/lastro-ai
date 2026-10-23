import { DEFAULT_WRITE_FRACTION, type ComponentType } from '../../shared/simulation.js';

export interface ComponentKind {
  type: ComponentType;
  label: string;
  /** Exemplos curtos, exibidos na paleta. */
  hint: string;
  /** Para que serve, em linguagem simples, exibido nas propriedades. */
  about: string;
  defaults: {
    instances: number;
    serviceTimeMs: number;
    monthlyCostPerInstance: number;
    writeFraction?: number;
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
    about: 'Recebe os acessos e reparte entre as cópias do componente seguinte, para nenhuma ficar sobrecarregada.',
    defaults: { instances: 1, serviceTimeMs: 1, monthlyCostPerInstance: 120 },
  },
  {
    type: 'app',
    label: 'Aplicação',
    hint: 'API ou serviço que atende o usuário',
    about: 'O seu código: a API, o site ou o serviço que responde ao usuário.',
    defaults: { instances: 2, serviceTimeMs: 20, monthlyCostPerInstance: 450 },
  },
  {
    type: 'cache',
    label: 'Cache',
    hint: 'Redis, Memcached',
    about: 'Memória rápida que guarda respostas prontas e poupa o banco de dados de repetir o mesmo trabalho.',
    defaults: { instances: 1, serviceTimeMs: 1, monthlyCostPerInstance: 350 },
  },
  {
    type: 'database',
    label: 'Banco de dados',
    hint: 'Postgres, MySQL, MongoDB',
    about: 'Onde os dados ficam guardados. Costuma ser a parte mais difícil de escalar.',
    defaults: { instances: 1, serviceTimeMs: 10, monthlyCostPerInstance: 1800, writeFraction: DEFAULT_WRITE_FRACTION },
  },
  {
    type: 'queue',
    label: 'Fila',
    hint: 'SQS, RabbitMQ, Kafka',
    about: 'Guarda tarefas para serem feitas depois, sem o usuário precisar esperar.',
    defaults: { instances: 1, serviceTimeMs: 0.5, monthlyCostPerInstance: 80 },
  },
  {
    type: 'worker',
    label: 'Worker',
    hint: 'Processa trabalho em segundo plano',
    about: 'Pega as tarefas da fila e faz o trabalho pesado em segundo plano.',
    defaults: { instances: 2, serviceTimeMs: 50, monthlyCostPerInstance: 300 },
  },
  {
    type: 'external',
    label: 'Serviço externo',
    hint: 'Gateway de pagamento, API de terceiros',
    about: 'Serviço de outra empresa, como pagamento ou envio de e-mail. Só o tempo de resposta dele entra na conta.',
    defaults: { instances: 1, serviceTimeMs: 200, monthlyCostPerInstance: 0 },
  },
];

const BY_TYPE = new Map(CATALOG.map((k) => [k.type, k]));

export function kindOf(type: ComponentType): ComponentKind {
  return BY_TYPE.get(type) ?? CATALOG[1]!;
}
