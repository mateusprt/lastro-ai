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
      {saturated ? 'Saturado' : STATUS_LABEL[status]}
    </span>
  );
}

interface GaugeProps {
  utilization: number;
  safeUtilization: number;
  status: ComponentStatus;
  saturated: boolean;
  compact?: boolean;
}

/**
 * Medidor de utilização com a linha de carga: o traço marca o limite seguro,
 * como a marca de Plimsoll no casco indica até onde o navio pode afundar.
 */
export function LoadGauge({ utilization, safeUtilization, status, saturated, compact = false }: GaugeProps) {
  const fill = Math.min(1, Math.max(0, utilization));
  return (
    <div className={`gauge${compact ? ' gauge-compact' : ''}`}>
      <div
        className="gauge-track"
        role="meter"
        aria-label="Utilização"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
        aria-valuetext={`${formatPercent(utilization)}, limite seguro ${formatPercent(safeUtilization)}`}
      >
        <div className={`gauge-fill gauge-${status}${saturated ? ' gauge-saturated' : ''}`} style={{ width: `${fill * 100}%` }} />
        <div className="gauge-line" style={{ left: `${safeUtilization * 100}%` }} />
      </div>
      <span className="gauge-value">{formatPercent(utilization)}</span>
    </div>
  );
}
