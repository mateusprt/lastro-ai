import type { ComponentResult, SimulationResult } from '../../shared/simulation.js';
import { formatMs, formatMultiplier, formatPercent, formatRps } from './format.js';

export type DiagnosisTone = 'ok' | 'warning' | 'critical';

/** Saídas quando o primário não dá conta das escritas. */
const PRIMARY_WAYS_OUT = 'use uma máquina maior para o primário, reduza as escritas (cache, lotes) ou particione os dados';

export interface Diagnosis {
  tone: DiagnosisTone;
  /** Frase principal, em linguagem simples. */
  headline: string;
  /** Complemento com a capacidade ou a ação sugerida. */
  detail: string;
}

/**
 * Traduz o resultado devolvido pela API em texto para o usuário. Apenas
 * formata números já calculados no servidor; não faz nenhuma conta de fila.
 */
export function diagnose(result: SimulationResult): Diagnosis {
  const { system, components, input } = result;
  const byId = new Map(components.map((c) => [c.id, c]));
  const limit = formatPercent(input.safeUtilization);

  if (system.bottleneckId === null) {
    return {
      tone: 'ok',
      headline: 'Nenhum componente com fila recebe tráfego.',
      detail: 'Só serviços externos estão no caminho, então a capacidade depende deles.',
    };
  }

  const b = byId.get(system.bottleneckId)!;
  const name = b.name || 'Componente sem nome';

  if (system.saturated) {
    const saturated = components.filter((c) => c.reachable && c.saturated);
    const needed = components
      .filter((c) => c.reachable && c.additionalInstances > 0)
      .map((c) => `${c.additionalInstances} ${c.additionalInstances === 1 ? 'instância' : 'instâncias'} em ${c.name || 'sem nome'}`);
    const primaries = components.filter((c) => c.reachable && c.database?.primaryOverSafe).map((c) => c.name || 'sem nome');
    const add = needed.length > 0 ? ` Para ficar abaixo de ${limit}, adicione ${joinList(needed)}.` : '';
    const primaryNote =
      primaries.length > 0
        ? ` O primário de ${joinList(primaries)} não dá conta das escritas, e mais réplicas não resolvem: ${PRIMARY_WAYS_OUT}.`
        : '';
    return {
      tone: 'critical',
      headline:
        saturated.length === 1
          ? `${saturated[0]!.name || 'Um componente'} não dá conta de ${formatRps(input.trafficRps)}: a fila cresce sem parar.`
          : `${saturated.length} componentes não dão conta de ${formatRps(input.trafficRps)}: as filas crescem sem parar.`,
      detail: `O máximo hoje é ${formatRps(system.maxCapacityRps)}.${add}${primaryNote}`,
    };
  }

  const headroom = system.safeCapacityRps !== null && input.trafficRps > 0 ? system.safeCapacityRps / input.trafficRps : null;
  const capacity =
    headroom === null
      ? `Dentro do limite seguro de ${limit}, a arquitetura aguenta até ${formatRps(system.safeCapacityRps)}.`
      : `Dentro do limite seguro de ${limit}, a arquitetura aguenta até ${formatRps(system.safeCapacityRps)}, ${formatMultiplier(headroom)} o tráfego atual.`;

  if (b.status === 'critical' && b.database?.primaryOverSafe) {
    return {
      tone: 'critical',
      headline: `O primário de ${name} está acima do limite seguro, a ${formatPercent(b.database.primary.utilization)} de utilização.`,
      detail: `Todas as escritas vão para ele, então mais réplicas não resolvem. Para voltar para baixo de ${limit}, ${PRIMARY_WAYS_OUT}.`,
    };
  }

  if (b.status === 'critical') {
    return {
      tone: 'critical',
      headline: `${name} está acima do limite seguro, a ${formatPercent(b.utilization)} de utilização.`,
      detail: `O tempo de resposta já é de ${formatMs(system.responseTimeMs)}. Com ${b.requiredInstances} instâncias, ${name} volta para baixo de ${limit}.`,
    };
  }

  const tone = b.status === 'warning' ? 'warning' : 'ok';
  const limitedBy = b.database?.limitedBy ?? null;
  if (limitedBy === 'primary') {
    return {
      tone,
      headline: `O gargalo é o primário de ${name}, a ${formatPercent(b.database!.primary.utilization)} de utilização.`,
      detail: `${capacity} Mais réplicas não aumentam esse limite, porque todas as escritas vão para o primário.`,
    };
  }
  return {
    tone,
    headline: `${bottleneckLabel(b, limitedBy)}, a ${formatPercent(b.utilization)} de utilização.`,
    detail: capacity,
  };
}

function bottleneckLabel(b: ComponentResult, limitedBy: 'primary' | 'replicas' | null): string {
  const name = b.name || 'Componente sem nome';
  if (limitedBy !== 'replicas') return `O gargalo é ${name}`;
  return b.database!.replicas!.servers === 1 ? `O gargalo é a réplica de ${name}` : `O gargalo são as réplicas de ${name}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? 'instâncias';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}
