import type { SimulationResult } from '../../shared/simulation.js';
import { formatMs, formatMultiplier, formatPercent, formatRps } from './format.js';

export type DiagnosisTone = 'ok' | 'warning' | 'critical';

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
    return {
      tone: 'critical',
      headline:
        saturated.length === 1
          ? `${saturated[0]!.name || 'Um componente'} não dá conta de ${formatRps(input.trafficRps)}: a fila cresce sem parar.`
          : `${saturated.length} componentes não dão conta de ${formatRps(input.trafficRps)}: as filas crescem sem parar.`,
      detail: `O máximo hoje é ${formatRps(system.maxCapacityRps)}. Para ficar abaixo de ${limit}, adicione ${joinList(needed)}.`,
    };
  }

  const headroom = system.safeCapacityRps !== null && input.trafficRps > 0 ? system.safeCapacityRps / input.trafficRps : null;
  const capacity =
    headroom === null
      ? `Dentro do limite seguro de ${limit}, a arquitetura aguenta até ${formatRps(system.safeCapacityRps)}.`
      : `Dentro do limite seguro de ${limit}, a arquitetura aguenta até ${formatRps(system.safeCapacityRps)}, ${formatMultiplier(headroom)} o tráfego atual.`;

  if (b.status === 'critical') {
    return {
      tone: 'critical',
      headline: `${name} está acima do limite seguro, a ${formatPercent(b.utilization)} de utilização.`,
      detail: `O tempo de resposta já é de ${formatMs(system.responseTimeMs)}. Com ${b.requiredInstances} instâncias, ${name} volta para baixo de ${limit}.`,
    };
  }

  return {
    tone: b.status === 'warning' ? 'warning' : 'ok',
    headline: `O gargalo é ${name}, a ${formatPercent(b.utilization)} de utilização.`,
    detail: capacity,
  };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? 'instâncias';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}
