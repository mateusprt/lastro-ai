import type { Edge, Node } from '@xyflow/react';
import type { ComponentType } from '../../shared/simulation.js';

/** Dados de um componente guardados no nó do React Flow. */
export interface ComponentData extends Record<string, unknown> {
  name: string;
  type: ComponentType;
  instances: number;
  serviceTimeMs: number;
  monthlyCostPerInstance: number;
  /** Só para banco de dados: fração das consultas que são escritas. */
  writeFraction?: number;

  // Modelagem avançada. Os valores ficam guardados mesmo com ela desligada;
  // só são enviados à API quando o diagrama está com a modelagem avançada ligada.
  /** Aplicação e worker. */
  autoscalingEnabled?: boolean;
  autoscalingMax?: number;
  autoscalingTarget?: number;
  /** Cache. */
  hitRate?: number;
  /** Banco de dados. */
  poolEnabled?: boolean;
  poolSize?: number;
  poolExtraHoldMs?: number;
  /** Serviço externo. */
  rateLimitEnabled?: boolean;
  rateLimitRps?: number;
}

export interface LinkData extends Record<string, unknown> {
  callsPerRequest: number;
  async: boolean;
}

export type ComponentNode = Node<ComponentData, 'component'>;
export type LinkEdge = Edge<LinkData, 'link'>;

/** O documento editável: tudo que o usuário salva e desfaz. */
export interface DiagramDoc {
  name: string;
  nodes: ComponentNode[];
  edges: LinkEdge[];
  entryPointId: string | null;
  trafficRps: number;
  safeUtilization: number;
  /** Autoscaling, taxa de acerto, pool de conexões e limites de terceiros entram no cálculo. */
  advancedModeling: boolean;
}
