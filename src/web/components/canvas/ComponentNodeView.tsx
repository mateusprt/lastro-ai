import { Fragment, memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { autoscalingMax, canAutoscale, hitRate, poolSize, rateLimitRps } from '../../domain/advanced.js';
import { kindOf } from '../../domain/catalog.js';
import { formatMs, formatNumber, formatPercent } from '../../domain/format.js';
import { DEFAULT_WRITE_FRACTION, type ComponentStatus } from '../../../shared/simulation.js';
import { useEditor } from '../../store/editor.js';
import { useSimulation } from '../../store/simulation.js';
import type { ComponentData, ComponentNode } from '../../store/types.js';
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
  const advanced = useEditor((s) => s.advancedModeling);

  const spec = specLine(data, advanced);
  const unreachable = result && !result.reachable;
  const db = result?.database;
  const pool = result?.connectionPool;
  const need = !result
    ? null
    : db?.primaryOverSafe
      ? 'Primário no limite'
      : pool && pool.status === 'critical' && pool.requiredSize !== null && pool.requiredSize > pool.size
        ? `Pool: ${pool.requiredSize} conexões`
        : result.rateLimit && result.status === 'critical'
          ? 'Limite do fornecedor'
          : result.autoscaling && result.additionalInstances > 0
            ? result.autoscaling.atMax
              ? `Máximo: ${result.autoscaling.requiredMaxInstances}`
              : 'Alvo acima do limite'
            : result.additionalInstances > 0
              ? database
                ? `+${result.additionalInstances} ${result.additionalInstances === 1 ? 'réplica' : 'réplicas'}`
                : `+${result.additionalInstances} ${result.additionalInstances === 1 ? 'instância' : 'instâncias'}`
              : null;

  // Um medidor por fila que pode limitar o componente: primário e réplicas, banco e pool.
  const gauges: { label: string; title: string; utilization: number; status: ComponentStatus; saturated: boolean }[] = [];
  if (db?.replicas) {
    gauges.push({ label: 'Primário', title: 'Recebe todas as gravações', ...db.primary });
    gauges.push({ label: 'Réplicas', title: 'Dividem as leituras', ...db.replicas });
  } else if (db && pool) {
    gauges.push({ label: 'Banco', title: 'Ocupação da instância', ...db.primary });
  }
  if (pool) {
    gauges.push({
      label: 'Conexões',
      title: 'Conexões em uso no pool',
      utilization: pool.utilization ?? 1,
      status: pool.status,
      saturated: pool.saturated,
    });
  }
  const limited = external && result?.rateLimit !== undefined;

  return (
    <div
      className={[
        'node',
        selected ? 'is-selected' : '',
        hasIssue ? 'has-issue' : '',
        unreachable ? 'is-unreachable' : '',
        result && (!external || limited) && result.reachable ? `tone-${result.status}` : '',
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
        ) : external && !limited ? (
          <span className="node-muted">{formatNumber(result.throughputRps)} chamadas por segundo. Serviço externo, sem fila.</span>
        ) : (
          <>
            {gauges.length >= 2 ? (
              <div className="node-gauges">
                {gauges.map((g) => (
                  <Fragment key={g.label}>
                    <span className="node-gauge-label" title={g.title}>
                      {g.label}
                    </span>
                    <LoadGauge compact label={`Ocupação: ${g.label.toLowerCase()}`} utilization={g.utilization} safeUtilization={safe} status={g.status} saturated={g.saturated} />
                  </Fragment>
                ))}
              </div>
            ) : (
              <LoadGauge
                {...(limited ? { label: 'Uso do limite do fornecedor' } : {})}
                utilization={result.utilization}
                safeUtilization={safe}
                status={result.status}
                saturated={result.saturated}
              />
            )}
            <div className="node-foot">
              <StatusTag status={result.status} saturated={result.saturated} />
              {need && <span className="node-need">{need}</span>}
            </div>
            {db?.replicas && <span className="node-caveat">{pool ? 'Otimista: sem locks e atraso de réplica' : 'Otimista: sem locks, conexões e atraso de réplica'}</span>}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}

/** Linha de especificação do nó, com os recursos avançados ligados. */
function specLine(d: ComponentData, advanced: boolean): string {
  const ms = formatMs(d.serviceTimeMs);
  if (d.type === 'external') {
    const limit = advanced && d.rateLimitEnabled ? `, até ${formatNumber(rateLimitRps(d))} chamadas/s` : '';
    return `Latência fixa de ${ms}${limit}`;
  }
  if (d.type === 'database') {
    const pool = advanced && d.poolEnabled ? `, pool de ${poolSize(d)}` : '';
    return `${dbInstances(d.instances)}, ${ms} por consulta, ${formatPercent(d.writeFraction ?? DEFAULT_WRITE_FRACTION)} escritas${pool}`;
  }
  const count =
    advanced && canAutoscale(d) && d.autoscalingEnabled
      ? `${d.instances} a ${autoscalingMax(d)} instâncias (autoscaling)`
      : `${d.instances} ${d.instances === 1 ? 'instância' : 'instâncias'}`;
  const hit = advanced && d.type === 'cache' ? `, ${formatPercent(hitRate(d))} de acerto` : '';
  return `${count}, ${ms} por requisição${hit}`;
}

/** "1 instância" ou "1 primário + 2 réplicas". */
function dbInstances(instances: number): string {
  if (instances === 1) return '1 instância';
  const replicas = instances - 1;
  return `1 primário + ${replicas} ${replicas === 1 ? 'réplica' : 'réplicas'}`;
}

export const ComponentNodeView = memo(ComponentNodeViewImpl);
