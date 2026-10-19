/**
 * Contrato de entrada e saída da simulação, compartilhado entre API e frontend.
 * Somente tipos e constantes: nenhuma lógica de cálculo fica aqui.
 *
 * Convenções:
 * - Tempos de entrada e saída em milissegundos; internamente o motor usa segundos.
 * - Tráfego em requisições por segundo (req/s).
 * - Utilização e limite seguro como fração (0,8 = 80%).
 * - `null` em tempos e capacidades significa "ilimitado": tempo de resposta
 *   infinito (componente saturado) ou capacidade sem limite (nenhum
 *   componente com fila no caminho).
 */

export const COMPONENT_TYPES = [
  'load_balancer',
  'app',
  'cache',
  'database',
  'queue',
  'worker',
  'external',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export interface Position {
  x: number;
  y: number;
}

/** Nó do diagrama. */
export interface ComponentSpec {
  id: string;
  name: string;
  type: ComponentType;
  /** Número de instâncias (servidores em paralelo da fila M/M/c). Inteiro >= 1. */
  instances: number;
  /**
   * Tempo de serviço por visita, em ms. Para `external`, é a latência fixa
   * do serviço de terceiros (sem fila).
   */
  serviceTimeMs: number;
  /** Custo mensal de uma instância, em reais. */
  monthlyCostPerInstance: number;
  position?: Position;
}

/** Aresta do diagrama: `source` chama `target`. */
export interface LinkSpec {
  id?: string;
  source: string;
  target: string;
  /** Chamadas ao destino por requisição recebida na origem. 0,6 = 60% das requisições. */
  callsPerRequest: number;
  /** Se verdadeiro, a origem não espera a resposta: gera carga, mas não soma no tempo de resposta. */
  async: boolean;
}

export interface ArchitectureGraph {
  components: ComponentSpec[];
  links: LinkSpec[];
}

export interface SimulationInput {
  graph: ArchitectureGraph;
  /** Componente que recebe o tráfego de entrada. */
  entryPointId: string;
  /** Tráfego de entrada em req/s. */
  trafficRps: number;
  /** Utilização máxima aceitável, como fração em (0, 1). Padrão do produto: 0,8. */
  safeUtilization: number;
}

export type ComponentStatus = 'ok' | 'warning' | 'critical';

export interface ComponentResult {
  id: string;
  name: string;
  type: ComponentType;
  /** Existe caminho do ponto de entrada até o componente. */
  reachable: boolean;
  /** Visitas por requisição de entrada (geram carga). */
  visits: number;
  /** Visitas síncronas por requisição de entrada (somam no tempo de resposta). */
  syncVisits: number;
  /** Vazão no componente, em req/s. */
  throughputRps: number;
  /** Demanda de serviço D = visitas × S, em ms por requisição de entrada. */
  serviceDemandMs: number;
  /** Utilização média por instância. Pode passar de 1 quando saturado. Sempre 0 para `external`. */
  utilization: number;
  saturated: boolean;
  /** Probabilidade de uma visita esperar em fila (Erlang C). */
  waitProbability: number;
  /** Tempo de espera médio em fila por visita, em ms. `null` se saturado. */
  waitTimeMs: number | null;
  /** Tempo de resposta por visita (serviço + fila), em ms. `null` se saturado. */
  responseTimeMs: number | null;
  status: ComponentStatus;
  instances: number;
  /** Instâncias necessárias para ficar dentro do limite seguro no tráfego simulado. */
  requiredInstances: number;
  additionalInstances: number;
  monthlyCost: number;
  /** Custo mensal das instâncias adicionais. */
  extraMonthlyCost: number;
  /** Tráfego de entrada que leva este componente a 100%. `null` se ilimitado. */
  maxEntryRps: number | null;
  /** Tráfego de entrada que leva este componente ao limite seguro. `null` se ilimitado. */
  safeEntryRps: number | null;
}

export interface LinkResult {
  id?: string;
  source: string;
  target: string;
  async: boolean;
  /** Chamadas por segundo que passam pela ligação. */
  throughputRps: number;
}

export interface SystemResult {
  /** Componente com maior demanda por instância. `null` se nenhum componente com fila recebe carga. */
  bottleneckId: string | null;
  /** Maior tráfego de entrada com todos os componentes abaixo do limite seguro. `null` se ilimitado. */
  safeCapacityRps: number | null;
  /** Tráfego de entrada que leva o gargalo a 100%. `null` se ilimitado. */
  maxCapacityRps: number | null;
  /** Algum componente alcançável está saturado no tráfego simulado. */
  saturated: boolean;
  /** Tempo de resposta de ponta a ponta no caminho síncrono, em ms. `null` se saturado. */
  responseTimeMs: number | null;
  /** Há ligações assíncronas alcançáveis com tráfego. */
  hasBackgroundWork: boolean;
  /** Tempo para concluir o trabalho disparado por ligações assíncronas, em ms. `null` se saturado. */
  backgroundDelayMs: number | null;
  /** Lei de Little: média de requisições em andamento no caminho síncrono. `null` se saturado. */
  requestsInFlight: number | null;
  monthlyCost: number;
  extraMonthlyCost: number;
}

export interface CurvePoint {
  trafficRps: number;
  /** `null` se o sistema satura nesse tráfego. */
  responseTimeMs: number | null;
}

export interface SimulationResult {
  input: {
    entryPointId: string;
    trafficRps: number;
    safeUtilization: number;
  };
  components: ComponentResult[];
  links: LinkResult[];
  system: SystemResult;
  curve: CurvePoint[];
}
