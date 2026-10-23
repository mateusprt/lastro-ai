import { kindOf } from '../../domain/catalog.js';
import { formatMs, formatRps } from '../../domain/format.js';
import { useEditor } from '../../store/editor.js';
import { useSimulation } from '../../store/simulation.js';
import type { GlossaryKey } from '../../domain/glossary.js';
import { TypeIcon } from '../icons.js';
import { InfoTip } from '../InfoTip.js';
import { LoadGauge, StatusTag } from '../Status.js';

/** Tabela de componentes, do mais carregado para o menos. Clicar seleciona no diagrama. */
export function ComponentTable() {
  const result = useSimulation((s) => s.result);
  const stale = useSimulation((s) => s.stale);
  const safe = useEditor((s) => s.safeUtilization);
  const select = useEditor((s) => s.select);
  const selectedId = useEditor((s) => s.nodes.find((n) => n.selected)?.id);

  if (!result) return <p className="empty-hint">Os resultados aparecem aqui quando algum componente estiver marcado para receber os acessos.</p>;

  const rows = [...result.components].sort((a, b) => {
    if (a.reachable !== b.reachable) return a.reachable ? -1 : 1;
    if ((a.type === 'external') !== (b.type === 'external')) return a.type === 'external' ? 1 : -1;
    return b.utilization - a.utilization;
  });

  return (
    <div className={`table-wrap${stale ? ' is-stale' : ''}`}>
      <table className="results-table">
        <thead>
          <tr>
            <th scope="col">Componente</th>
            <Header className="num" info="throughput">
              Recebe
            </Header>
            <Header info="utilization">Ocupação</Header>
            <th scope="col">Situação</th>
            <Header className="num" info="responseTime">
              Tempo de resposta
            </Header>
            <Header className="num" info="requiredInstances">
              Instâncias
            </Header>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const external = c.type === 'external';
            return (
              <tr
                key={c.id}
                className={`${c.id === selectedId ? 'is-selected' : ''}${!c.reachable ? ' is-unreachable' : ''}`}
                onClick={() => select(c.id)}
              >
                <th scope="row">
                  <button type="button" className="row-button" onClick={() => select(c.id)}>
                    <TypeIcon type={c.type} size={16} />
                    <span>
                      <span className="row-name">{c.name || 'Sem nome'}</span>
                      <span className="row-kind">{kindOf(c.type).label}</span>
                    </span>
                  </button>
                </th>
                <td className="num">{c.reachable ? formatRps(c.throughputRps) : 'Nenhum acesso'}</td>
                <td>{c.reachable && !external ? <LoadGauge compact utilization={c.utilization} safeUtilization={safe} status={c.status} saturated={c.saturated} /> : <span className="muted">Sem fila</span>}</td>
                <td>{c.reachable && !external ? <StatusTag status={c.status} saturated={c.saturated} /> : null}</td>
                <td className="num">{!c.reachable ? '' : c.saturated ? 'Sobrecarregado' : formatMs(c.responseTimeMs)}</td>
                <td className="num">
                  {external ? '' : c.additionalInstances > 0 ? (
                    <>
                      {c.instances}{' '}
                      <span className="delta" title={`Recomendado: ${c.requiredInstances}`}>
                        → {c.requiredInstances}
                      </span>
                    </>
                  ) : (
                    c.instances
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Cabeçalho de coluna com o botão "?". O clique no botão não ordena nem seleciona nada. */
function Header({ info, className, children }: { info: GlossaryKey; className?: string; children: string }) {
  return (
    <th scope="col" {...(className ? { className } : {})}>
      <span className="th-term">
        {children}
        <InfoTip term={info} />
      </span>
    </th>
  );
}
