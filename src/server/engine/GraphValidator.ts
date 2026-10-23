import { COMPONENT_TYPES, type SimulationInput } from './types.js';
import { SimulationValidationError, type ValidationIssue } from './errors.js';

export interface GraphValidatorLimits {
  maxComponents: number;
  maxLinks: number;
  maxInstances: number;
  maxServiceTimeMs: number;
  maxTrafficRps: number;
}

/**
 * Limites de segurança do motor. Os limites de plano (ex.: 15 componentes no
 * gratuito) são aplicados antes, no service de simulação; estes protegem o
 * servidor contra entradas absurdas.
 */
export const DEFAULT_LIMITS: GraphValidatorLimits = {
  maxComponents: 200,
  maxLinks: 1000,
  maxInstances: 10_000,
  maxServiceTimeMs: 3_600_000,
  maxTrafficRps: 10_000_000,
};

/**
 * Valida a estrutura do grafo e os parâmetros da simulação. A validação de
 * formato (tipos, campos obrigatórios) é feita pelo Joi na API; aqui ficam as
 * regras que dependem do grafo como um todo: referências, duplicidades e ciclos.
 *
 * Reúne todos os problemas encontrados antes de lançar, para que o editor
 * possa destacar tudo de uma vez.
 */
export class GraphValidator {
  constructor(private readonly limits: GraphValidatorLimits = DEFAULT_LIMITS) {}

  validate(input: SimulationInput): void {
    const issues = this.collectIssues(input);
    if (issues.length > 0) throw new SimulationValidationError(issues);
  }

  collectIssues(input: SimulationInput): ValidationIssue[] {
    const { graph, entryPointId, trafficRps, safeUtilization } = input;
    const issues: ValidationIssue[] = [];
    const limits = this.limits;

    if (graph.components.length === 0) {
      issues.push({ code: 'EMPTY_GRAPH', message: 'O diagrama não tem componentes.' });
    }
    if (graph.components.length > limits.maxComponents) {
      issues.push({
        code: 'TOO_MANY_COMPONENTS',
        message: `O diagrama tem ${graph.components.length} componentes; o máximo é ${limits.maxComponents}.`,
      });
    }
    if (graph.links.length > limits.maxLinks) {
      issues.push({
        code: 'TOO_MANY_LINKS',
        message: `O diagrama tem ${graph.links.length} ligações; o máximo é ${limits.maxLinks}.`,
      });
    }

    // Componentes
    const ids = new Set<string>();
    for (const c of graph.components) {
      const label = c.name || c.id;
      if (typeof c.id !== 'string' || c.id.trim() === '') {
        issues.push({ code: 'INVALID_COMPONENT_ID', message: 'Há um componente sem identificador.' });
        continue;
      }
      if (ids.has(c.id)) {
        issues.push({
          code: 'DUPLICATE_COMPONENT_ID',
          message: `O identificador "${c.id}" está repetido.`,
          componentIds: [c.id],
        });
      }
      ids.add(c.id);

      if (!(COMPONENT_TYPES as readonly string[]).includes(c.type)) {
        issues.push({
          code: 'INVALID_COMPONENT_TYPE',
          message: `${label}: tipo de componente desconhecido.`,
          componentIds: [c.id],
        });
      }
      if (!Number.isInteger(c.instances) || c.instances < 1 || c.instances > limits.maxInstances) {
        issues.push({
          code: 'INVALID_INSTANCES',
          message: `${label}: o número de instâncias deve ser um inteiro entre 1 e ${limits.maxInstances}.`,
          componentIds: [c.id],
        });
      }
      // Serviço externo pode ter latência 0; os demais precisam de tempo de serviço positivo.
      const minOk = c.type === 'external' ? c.serviceTimeMs >= 0 : c.serviceTimeMs > 0;
      if (!Number.isFinite(c.serviceTimeMs) || !minOk || c.serviceTimeMs > limits.maxServiceTimeMs) {
        issues.push({
          code: 'INVALID_SERVICE_TIME',
          message:
            c.type === 'external'
              ? `${label}: a latência deve ser um número entre 0 e ${limits.maxServiceTimeMs} ms.`
              : `${label}: o tempo de serviço deve ser maior que 0 e no máximo ${limits.maxServiceTimeMs} ms.`,
          componentIds: [c.id],
        });
      }
      if (c.writeFraction !== undefined && !(Number.isFinite(c.writeFraction) && c.writeFraction >= 0 && c.writeFraction <= 1)) {
        issues.push({
          code: 'INVALID_WRITE_FRACTION',
          message: `${label}: o percentual de escritas deve estar entre 0% e 100%.`,
          componentIds: [c.id],
        });
      }
      if (!Number.isFinite(c.monthlyCostPerInstance) || c.monthlyCostPerInstance < 0) {
        issues.push({
          code: 'INVALID_COST',
          message: `${label}: o custo mensal deve ser um número >= 0.`,
          componentIds: [c.id],
        });
      }
    }

    // Ligações
    const pairs = new Set<string>();
    graph.links.forEach((l, linkIndex) => {
      const srcOk = ids.has(l.source);
      const tgtOk = ids.has(l.target);
      if (!srcOk) {
        issues.push({
          code: 'UNKNOWN_LINK_SOURCE',
          message: `Uma ligação parte de um componente inexistente ("${l.source}").`,
          linkIndex,
        });
      }
      if (!tgtOk) {
        issues.push({
          code: 'UNKNOWN_LINK_TARGET',
          message: `Uma ligação aponta para um componente inexistente ("${l.target}").`,
          linkIndex,
        });
      }
      if (l.source === l.target) {
        issues.push({
          code: 'SELF_LINK',
          message: 'Um componente não pode chamar a si mesmo.',
          componentIds: [l.source],
          linkIndex,
        });
      }
      const key = `${l.source}\u0000${l.target}`;
      if (srcOk && tgtOk && pairs.has(key)) {
        issues.push({
          code: 'DUPLICATE_LINK',
          message: 'Há duas ligações entre os mesmos componentes; junte-as somando as chamadas por requisição.',
          componentIds: [l.source, l.target],
          linkIndex,
        });
      }
      pairs.add(key);
      if (!Number.isFinite(l.callsPerRequest) || l.callsPerRequest < 0) {
        issues.push({
          code: 'INVALID_LINK_WEIGHT',
          message: 'As chamadas por requisição de uma ligação devem ser um número >= 0.',
          componentIds: [l.source, l.target],
          linkIndex,
        });
      }
    });

    // Ciclos (só faz sentido com referências válidas)
    const cycle = findCycle(
      [...ids],
      graph.links.filter((l) => ids.has(l.source) && ids.has(l.target) && l.source !== l.target),
    );
    if (cycle) {
      issues.push({
        code: 'CYCLE',
        message: `O diagrama tem um ciclo: ${cycle.join(' → ')}. Chamadas circulares não são suportadas.`,
        componentIds: [...new Set(cycle)],
      });
    }

    // Parâmetros
    if (!ids.has(entryPointId)) {
      issues.push({
        code: 'UNKNOWN_ENTRY_POINT',
        message: 'O ponto de entrada não corresponde a nenhum componente do diagrama.',
      });
    }
    if (!Number.isFinite(trafficRps) || trafficRps < 0 || trafficRps > limits.maxTrafficRps) {
      issues.push({
        code: 'INVALID_TRAFFIC',
        message: `O tráfego de entrada deve ser um número entre 0 e ${limits.maxTrafficRps} req/s.`,
      });
    }
    if (!Number.isFinite(safeUtilization) || safeUtilization <= 0 || safeUtilization >= 1) {
      issues.push({
        code: 'INVALID_SAFE_UTILIZATION',
        message: 'O limite seguro deve estar entre 0% e 100% (exclusive).',
      });
    }

    return issues;
  }
}

/** Busca em profundidade iterativa; devolve o primeiro ciclo encontrado como lista de ids. */
function findCycle(ids: string[], links: { source: string; target: string }[]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const l of links) adj.get(l.source)?.push(l.target);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(ids.map((id) => [id, WHITE]));
  const parent = new Map<string, string>();

  for (const start of ids) {
    if (color.get(start) !== WHITE) continue;
    const stack: { node: string; next: number }[] = [{ node: start, next: 0 }];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = adj.get(frame.node) ?? [];
      if (frame.next < neighbors.length) {
        const to = neighbors[frame.next++]!;
        const c = color.get(to);
        if (c === WHITE) {
          parent.set(to, frame.node);
          color.set(to, GRAY);
          stack.push({ node: to, next: 0 });
        } else if (c === GRAY) {
          // Reconstrói o ciclo de `to` até `frame.node`.
          const cycle = [frame.node];
          let cur = frame.node;
          while (cur !== to) {
            cur = parent.get(cur)!;
            cycle.push(cur);
          }
          cycle.reverse();
          cycle.push(to);
          return cycle;
        }
      } else {
        color.set(frame.node, BLACK);
        stack.pop();
      }
    }
  }
  return null;
}
