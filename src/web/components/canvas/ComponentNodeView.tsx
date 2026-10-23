import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { kindOf } from '../../domain/catalog.js';
import { formatMs, formatNumber, formatPercent } from '../../domain/format.js';
import { DEFAULT_WRITE_FRACTION } from '../../../shared/simulation.js';
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
  const database = data.type === 'database';

  const spec = external
    ? `Latência fixa de ${formatMs(data.serviceTimeMs)}`
    : database
      ? `${dbInstances(data.instances)}, ${formatMs(data.serviceTimeMs)} por consulta, ${formatPercent(data.writeFraction ?? DEFAULT_WRITE_FRACTION)} escritas`
      : `${data.instances} ${data.instances === 1 ? 'instância' : 'instâncias'}, ${formatMs(data.serviceTimeMs)} por requisição`;

  const unreachable = result && !result.reachable;
  const db = result?.database;
  const need = db?.primaryOverSafe
    ? 'Primário no limite'
    : result && result.additionalInstances > 0
      ? database
        ? `+${result.additionalInstances} ${result.additionalInstances === 1 ? 'réplica' : 'réplicas'}`
        : `+${result.additionalInstances} ${result.additionalInstances === 1 ? 'instância' : 'instâncias'}`
      : null;

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
        <div className="node-entry" title="Os acessos dos usuários chegam por este componente">
          <EntryIcon size={14} />
          Acessos chegam aqui
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
          <span className="node-muted">Nenhum acesso chega aqui. Ligue-o a partir de um componente que recebe acessos.</span>
        ) : external ? (
          <span className="node-muted">{formatNumber(result.throughputRps)} chamadas por segundo. Serviço externo, sem fila.</span>
        ) : (
          <>
            {db?.replicas ? (
              <div className="node-gauges">
                <span className="node-gauge-label" title="Recebe todas as gravações">
                  Primário
                </span>
                <LoadGauge compact label="Utilização do primário" utilization={db.primary.utilization} safeUtilization={safe} status={db.primary.status} saturated={db.primary.saturated} />
                <span className="node-gauge-label" title="Dividem as leituras">
                  Réplicas
                </span>
                <LoadGauge compact label="Utilização das réplicas" utilization={db.replicas.utilization} safeUtilization={safe} status={db.replicas.status} saturated={db.replicas.saturated} />
              </div>
            ) : (
              <LoadGauge utilization={result.utilization} safeUtilization={safe} status={result.status} saturated={result.saturated} />
            )}
            <div className="node-foot">
              <StatusTag status={result.status} saturated={result.saturated} />
              {need && <span className="node-need">{need}</span>}
            </div>
            {db?.replicas && <span className="node-caveat">Otimista: sem locks, conexões e atraso de réplica</span>}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}

/** "1 instância" ou "1 primário + 2 réplicas". */
function dbInstances(instances: number): string {
  if (instances === 1) return '1 instância';
  const replicas = instances - 1;
  return `1 primário + ${replicas} ${replicas === 1 ? 'réplica' : 'réplicas'}`;
}

export const ComponentNodeView = memo(ComponentNodeViewImpl);
