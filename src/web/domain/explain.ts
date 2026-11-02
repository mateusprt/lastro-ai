import type { ComponentResult } from '../../shared/simulation.js';
import { formatMs, formatNumber, formatPercent, formatRps } from './format.js';

/**
 * Frases que leem o resultado de um componente ou de uma ligação em linguagem
 * simples. Como o diagnóstico, só formatam números já calculados na API.
 */

/**
 * O que fazer com um componente acima do limite seguro, como frase sem ponto
 * final ("aumente o pool de conexões de 20 para 30"). `null` se nada resolve
 * ou nada é necessário.
 */
export function remedyFor(r: ComponentResult, safeUtilization: number): string | null {
  if (r.database?.primaryOverSafe) {
    return 'as gravações sozinhas passam do limite do primário, e mais réplicas não resolvem: use uma máquina maior para o primário, reduza as gravações (cache, lotes) ou divida os dados entre bancos';
  }
  const pool = r.connectionPool;
  if (pool && pool.status === 'critical' && pool.requiredSize !== null && pool.requiredSize > pool.size) {
    return `aumente o pool de conexões de ${pool.size} para ${pool.requiredSize}`;
  }
  if (r.rateLimit && r.status === 'critical') {
    return `peça ao fornecedor um limite de ${formatNumber(Math.ceil(r.rateLimit.requiredLimitRps))} chamadas por segundo (hoje são ${formatNumber(r.rateLimit.limitRps)})`;
  }
  if (r.autoscaling && r.additionalInstances > 0) {
    return r.autoscaling.atMax
      ? `suba o máximo do autoscaling de ${r.autoscaling.maxInstances} para ${r.autoscaling.requiredMaxInstances} instâncias`
      : `baixe a ocupação-alvo do autoscaling para até ${formatPercent(safeUtilization)}, porque hoje ela fica acima do limite`;
  }
  if (r.additionalInstances > 0) {
    return `passe para ${r.requiredInstances} ${r.requiredInstances === 1 ? 'instância' : 'instâncias'}`;
  }
  return null;
}

/** Resumo de uma linha sobre o estado de um componente alcançável. */
export function describeComponent(r: ComponentResult, safeUtilization: number): string {
  const limit = formatPercent(safeUtilization);
  if (r.type === 'external' && !r.rateLimit) {
    return `Recebe ${formatNumber(r.throughputRps)} chamadas por segundo e responde em ${formatMs(r.responseTimeMs)}. Serviços externos sem limite não formam fila aqui.`;
  }

  const remedy = remedyFor(r, safeUtilization);
  const fix = remedy ? ` Para voltar para baixo de ${limit}, ${remedy}.` : '';
  const scaling = r.autoscaling
    ? ` O autoscaling ligou ${r.autoscaling.activeInstances} de no máximo ${r.autoscaling.maxInstances} instâncias.`
    : '';

  if (r.rateLimit) {
    const use = `Usa ${formatPercent(r.utilization)} do limite de ${formatNumber(r.rateLimit.limitRps)} chamadas por segundo do fornecedor`;
    if (r.saturated) return `Recebe ${formatNumber(r.throughputRps)} chamadas por segundo, acima do limite do fornecedor: as chamadas a mais são recusadas.${fix}`;
    if (r.status === 'critical') return `${use}, acima dos ${limit} aceitáveis.${fix}`;
    if (r.status === 'warning') return `${use}, perto do limite. Um pico pode fazer o fornecedor recusar chamadas.`;
    return `${use}, com folga.`;
  }

  if (r.saturated) {
    const why = r.connectionPool?.saturated && r.database && !r.database.primary.saturated && !r.database.replicas?.saturated
      ? 'faltam conexões no pool, e a espera por uma conexão livre cresce sem parar'
      : 'a fila cresce sem parar';
    return `Recebe ${formatRps(r.throughputRps)}, mais do que consegue atender: ${why}.${fix}`;
  }
  // Quando a maior ocupação é a do pool, o número não é da instância: vale dizer.
  const poolIsBusiest = r.connectionPool?.utilization !== null && r.connectionPool?.utilization === r.utilization;
  const busy = poolIsBusiest ? `O pool de conexões está ${formatPercent(r.utilization)} ocupado` : `Está ${formatPercent(r.utilization)} ocupado`;
  if (r.status === 'critical') return `${busy}, acima dos ${limit} aceitáveis.${fix}${scaling}`;
  if (r.status === 'warning') return `${busy}, perto do limite de ${limit}. Ainda responde bem, mas tem pouca folga para picos.${scaling}`;
  return r.safeEntryRps === null
    ? `${busy}, com folga.${scaling}`
    : `${busy}, com folga. Chega a ${limit} quando a entrada passar de ${formatRps(r.safeEntryRps)}.${scaling}`;
}

/** Lê o peso de uma ligação: "Chama o destino em 40% das requisições." */
export function describeCalls(calls: number): string {
  if (calls === 0) return 'Não chama o destino.';
  if (calls < 1) return `Chama o destino em ${formatPercent(calls)} das requisições.`;
  if (calls === 1) return 'Chama o destino uma vez a cada requisição.';
  if (Number.isInteger(calls)) return `Chama o destino ${formatNumber(calls)} vezes a cada requisição.`;
  return `Chama o destino ${formatNumber(calls)} vezes a cada requisição, em média.`;
}
