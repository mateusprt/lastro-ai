import type { ComponentResult } from '../../shared/simulation.js';
import { formatMs, formatNumber, formatPercent, formatRps } from './format.js';

/**
 * Frases que leem o resultado de um componente ou de uma ligação em linguagem
 * simples. Como o diagnóstico, só formatam números já calculados na API.
 */

/** Resumo de uma linha sobre o estado de um componente alcançável. */
export function describeComponent(r: ComponentResult, safeUtilization: number): string {
  const limit = formatPercent(safeUtilization);
  if (r.type === 'external') {
    return `Recebe ${formatNumber(r.throughputRps)} chamadas por segundo e responde em ${formatMs(r.responseTimeMs)}. Serviços externos não formam fila aqui.`;
  }

  const fix = r.database?.primaryOverSafe
    ? 'As gravações sozinhas já passam do limite do primário, e mais réplicas não resolvem.'
    : `Com ${r.requiredInstances} ${r.requiredInstances === 1 ? 'instância' : 'instâncias'}, volta para baixo de ${limit}.`;

  if (r.saturated) {
    return `Recebe ${formatRps(r.throughputRps)}, mais do que consegue atender: a fila cresce sem parar. ${fix}`;
  }
  const busy = `Está ${formatPercent(r.utilization)} ocupado`;
  if (r.status === 'critical') return `${busy}, acima dos ${limit} aceitáveis. ${fix}`;
  if (r.status === 'warning') return `${busy}, perto do limite de ${limit}. Ainda responde bem, mas tem pouca folga para picos.`;
  return r.safeEntryRps === null
    ? `${busy}, com folga.`
    : `${busy}, com folga. Chega a ${limit} quando a entrada passar de ${formatRps(r.safeEntryRps)}.`;
}

/** Lê o peso de uma ligação: "Chama o destino em 40% das requisições." */
export function describeCalls(calls: number): string {
  if (calls === 0) return 'Não chama o destino.';
  if (calls < 1) return `Chama o destino em ${formatPercent(calls)} das requisições.`;
  if (calls === 1) return 'Chama o destino uma vez a cada requisição.';
  if (Number.isInteger(calls)) return `Chama o destino ${formatNumber(calls)} vezes a cada requisição.`;
  return `Chama o destino ${formatNumber(calls)} vezes a cada requisição, em média.`;
}
