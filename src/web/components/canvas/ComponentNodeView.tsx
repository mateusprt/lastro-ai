import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { kindOf } from '../../domain/catalog.js';
import { formatMs, formatNumber } from '../../domain/format.js';
import { useEditor } from '../../store/editor.js';
import { useSimulation } from '../../store/simulation.js';
import type { ComponentNode } from '../../store/types.js';
import { EntryIcon, TypeIcon } from '../icons.js';
import { LoadGauge, StatusTag } from '../Status.js';

function ComponentNodeViewImpl({ id, data, selected }: NodeProps<ComponentNode>) {
  const result = useSimulation((s) => s.byId.get(id));
  const stale = useSimulation((s) => s.stale);
  const hasIssue = useSimulation((s) => s.issueIds.has(id));
  const isEntry = useEditor((s) => s.entryPointId === id);
  const safe = useEditor((s) => s.safeUtilization);
  const kind = kindOf(data.type);
  const external = data.type === 'external';

  const spec = external
    ? `Latência fixa de ${formatMs(data.serviceTimeMs)}`
    : `${data.instances} ${data.instances === 1 ? 'instância' : 'instâncias'}, ${formatMs(data.serviceTimeMs)} por requisição`;

  const unreachable = result && !result.reachable;

  return (
    <div
      className={[
        'node',
        selected ? 'is-selected' : '',
        hasIssue ? 'has-issue' : '',
        unreachable ? 'is-unreachable' : '',
        result && !external && result.reachable ? `tone-${result.status}` : '',
      ].join(' ')}
    >
      {isEntry && (
        <div className="node-entry" title="O tráfego de entrada chega aqui">
          <EntryIcon size={14} />
          Entrada
        </div>
      )}
      <Handle type="target" position={Position.Left} className="handle" />
      <div className="node-head">
        <span className="node-icon">
          <TypeIcon type={data.type} size={18} />
        </span>
        <div className="node-titles">
          <div className="node-name">{data.name || 'Sem nome'}</div>
          <div className="node-kind">{kind.label}</div>
        </div>
      </div>
      <div className="node-spec">{spec}</div>

      <div className={`node-result${stale ? ' is-stale' : ''}`}>
        {!result ? (
          <span className="node-muted">Aguardando simulação</span>
        ) : unreachable ? (
          <span className="node-muted">Sem tráfego: nada chega aqui a partir da entrada</span>
        ) : external ? (
          <span className="node-muted">{formatNumber(result.throughputRps)} chamadas/s, sem fila</span>
        ) : (
          <>
            <LoadGauge utilization={result.utilization} safeUtilization={safe} status={result.status} saturated={result.saturated} />
            <div className="node-foot">
              <StatusTag status={result.status} saturated={result.saturated} />
              {result.additionalInstances > 0 && <span className="node-need">+{result.additionalInstances} inst.</span>}
            </div>
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}

export const ComponentNodeView = memo(ComponentNodeViewImpl);
