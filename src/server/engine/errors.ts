export type ValidationIssueCode =
  | 'EMPTY_GRAPH'
  | 'TOO_MANY_COMPONENTS'
  | 'TOO_MANY_LINKS'
  | 'INVALID_COMPONENT_ID'
  | 'DUPLICATE_COMPONENT_ID'
  | 'INVALID_COMPONENT_TYPE'
  | 'INVALID_INSTANCES'
  | 'INVALID_SERVICE_TIME'
  | 'INVALID_COST'
  | 'UNKNOWN_LINK_SOURCE'
  | 'UNKNOWN_LINK_TARGET'
  | 'SELF_LINK'
  | 'DUPLICATE_LINK'
  | 'INVALID_LINK_WEIGHT'
  | 'CYCLE'
  | 'UNKNOWN_ENTRY_POINT'
  | 'INVALID_TRAFFIC'
  | 'INVALID_SAFE_UTILIZATION';

export interface ValidationIssue {
  code: ValidationIssueCode;
  /** Mensagem em português, pronta para exibir ao usuário. */
  message: string;
  /** Ids de componentes envolvidos, para destacar no editor. */
  componentIds?: string[];
  /** Índice da ligação envolvida, quando houver. */
  linkIndex?: number;
}

/** Erro lançado quando o grafo ou os parâmetros não podem ser simulados. */
export class SimulationValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Simulação inválida: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'SimulationValidationError';
    this.issues = issues;
  }
}
