import type { ComponentStatus } from '../../shared/simulation.js';
import { formatPercent } from '../domain/format.js';
import { CheckIcon, CriticalIcon, WarnIcon } from './icons.js';

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  ok: 'Folgado',
  warning: 'Atenção',
  critical: 'Crítico',
};

/** Status sempre com ícone e texto: a cor nunca carrega o significado sozinha. */
export function StatusTag({ status, saturated = false }: { status: ComponentStatus; saturated?: boolean }) {
  const Icon = status === 'ok' ? CheckIcon : status === 'warning' ? WarnIcon : CriticalIcon;
  return (
    <span className={`status status-${status}`}>
      <Icon size={14} />
      {saturated ? 'Sobrecarregado' : STATUS_LABEL[status]}
    </span>
  );
}

interface GaugeProps {
  utilization: number;
  safeUtilization: number;
  status: ComponentStatus;
  saturated: boolean;
  compact?: boolean;
  /** Nome lido por leitores de tela. Padrão: "Utilização". */
  label?: string;
}

/** Explicação do medidor para quem passa o mouse por cima. */
function gaugeTitle(utilization: number, safeUtilization: number): string {
  return `${formatPercent(utilization)} ocupado. O traço marca a ocupação máxima aceitável, ${formatPercent(safeUtilization)}.`;
}

/**
 * Medidor de utilização com a linha de carga: o traço marca o limite seguro,
 * como a marca de Plimsoll no casco indica até onde o navio pode afundar.
 */
export function LoadGauge({ utilization, safeUtilization, status, saturated, compact = false, label = 'Utilização' }: GaugeProps) {
  const fill = Math.min(1, Math.max(0, utilization));
  return (
    <div className={`gauge${compact ? ' gauge-compact' : ''}`} title={gaugeTitle(utilization, safeUtilization)}>
      <div
        className="gauge-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
        aria-valuetext={`${formatPercent(utilization)} ocupado, máximo aceitável ${formatPercent(safeUtilization)}`}
      >
        <div className={`gauge-fill gauge-${status}${saturated ? ' gauge-saturated' : ''}`} style={{ width: `${fill * 100}%` }} />
        <div className="gauge-line" style={{ left: `${safeUtilization * 100}%` }} />
      </div>
      <span className="gauge-value">{formatPercent(utilization)}</span>
    </div>
  );
}
