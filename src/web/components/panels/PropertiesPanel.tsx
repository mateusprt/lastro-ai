import { CATALOG, kindOf } from '../../domain/catalog.js';
import { formatMs, formatNumber, formatPercent, formatRps } from '../../domain/format.js';
import { selectedEdge, selectedNode, useEditor } from '../../store/editor.js';
import { useSimulation } from '../../store/simulation.js';
import type { ComponentNode, LinkEdge } from '../../store/types.js';
import type { ComponentType } from '../../../shared/simulation.js';
import { NumberField, TextField, Toggle } from '../fields.js';
import { EntryIcon, TrashIcon, TypeIcon } from '../icons.js';
import { StatusTag } from '../Status.js';

export function PropertiesPanel() {
  const node = useEditor(selectedNode);
  const edge = useEditor(selectedEdge);
  const count = useEditor((s) => s.nodes.filter((n) => n.selected).length + s.edges.filter((e) => e.selected).length);

  return (
    <section className="panel properties" aria-label={node ? 'Componente' : edge ? 'Ligação' : 'Propriedades'}>
      {node ? (
        <ComponentProperties key={node.id} node={node} />
      ) : edge ? (
        <LinkProperties key={edge.id} edge={edge} />
      ) : count > 1 ? (
        <MultiSelection count={count} />
      ) : (
        <p className="empty-hint">Selecione um componente ou uma ligação no diagrama para editar.</p>
      )}
    </section>
  );
}

function ComponentProperties({ node }: { node: ComponentNode }) {
  const update = useEditor((s) => s.updateComponent);
  const isEntry = useEditor((s) => s.entryPointId === node.id);
  const r = useSimulation((s) => s.byId.get(node.id));
  const d = node.data;
  const external = d.type === 'external';

  return (
    <div className="props">
      <TextField label="Nome" value={d.name} onChange={(name) => update(node.id, { name })} placeholder={kindOf(d.type).label} />

      <div className="field">
        <label className="field-label" htmlFor="prop-type">
          Tipo
        </label>
        <div className="field-control select">
          <span className="select-icon">
            <TypeIcon type={d.type} size={16} />
          </span>
          <select id="prop-type" value={d.type} onChange={(e) => update(node.id, { type: e.target.value as ComponentType })}>
            {CATALOG.map((k) => (
              <option key={k.type} value={k.type}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {external ? (
        <NumberField
          label="Latência"
          unit="ms"
          value={d.serviceTimeMs}
          min={0}
          onChange={(serviceTimeMs) => update(node.id, { serviceTimeMs })}
          hint="Tempo que o serviço de terceiros leva para responder. Ele não tem fila."
        />
      ) : (
        <>
          <NumberField label="Instâncias" value={d.instances} integer min={1} max={10000} onChange={(instances) => update(node.id, { instances })} />
          <NumberField
            label="Tempo de serviço"
            unit="ms"
            value={d.serviceTimeMs}
            min={0}
            exclusiveMin
            onChange={(serviceTimeMs) => update(node.id, { serviceTimeMs })}
            hint={
              <>
                Tempo processando uma requisição, sem a espera na fila. Para estimar pelas métricas: utilização × instâncias ÷ req/s. Ex.: 50% × 4 ÷
                100 req/s = 20 ms.
              </>
            }
          />
        </>
      )}

      <NumberField
        label="Custo mensal por instância"
        unit="R$"
        value={d.monthlyCostPerInstance}
        min={0}
        onChange={(monthlyCostPerInstance) => update(node.id, { monthlyCostPerInstance })}
      />

      <div className="entry-row">
        {isEntry ? (
          <p className="entry-on">
            <EntryIcon size={16} />O tráfego de entrada chega neste componente.
          </p>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => useEditor.getState().setEntryPoint(node.id)}>
            <EntryIcon size={16} />
            Usar como ponto de entrada
          </button>
        )}
      </div>

      {r && r.reachable && (
        <dl className="mini-stats">
          <div>
            <dt>Vazão</dt>
            <dd>{formatRps(r.throughputRps)}</dd>
          </div>
          {!external && (
            <div>
              <dt>Utilização</dt>
              <dd>
                {formatPercent(r.utilization)} <StatusTag status={r.status} saturated={r.saturated} />
              </dd>
            </div>
          )}
          <div>
            <dt>Tempo de resposta</dt>
            <dd>{r.saturated ? 'Fila sem limite' : formatMs(r.responseTimeMs)}</dd>
          </div>
          {!external && (
            <div>
              <dt>Instâncias para o limite seguro</dt>
              <dd>
                {r.requiredInstances}
                {r.additionalInstances > 0 && <span className="delta"> (+{r.additionalInstances})</span>}
              </dd>
            </div>
          )}
        </dl>
      )}

      <button type="button" className="btn btn-danger" onClick={() => useEditor.getState().deleteComponent(node.id)}>
        <TrashIcon size={16} />
        Excluir componente
      </button>
    </div>
  );
}

function LinkProperties({ edge }: { edge: LinkEdge }) {
  const update = useEditor((s) => s.updateLink);
  const source = useEditor((s) => s.nodes.find((n) => n.id === edge.source)?.data.name);
  const target = useEditor((s) => s.nodes.find((n) => n.id === edge.target)?.data.name);
  const flow = useSimulation((s) => s.result?.links.find((l) => l.id === edge.id)?.throughputRps);
  const calls = edge.data?.callsPerRequest ?? 1;
  const isAsync = edge.data?.async ?? false;

  return (
    <div className="props">
      <p className="link-route">
        <strong>{source || 'Sem nome'}</strong> chama <strong>{target || 'Sem nome'}</strong>
      </p>
      <NumberField
        label="Chamadas por requisição"
        value={calls}
        min={0}
        onChange={(callsPerRequest) => update(edge.id, { callsPerRequest })}
        hint={`Quantas vezes o destino é chamado para cada requisição recebida. 0,6 significa que 60% das requisições chegam lá; 2 significa duas chamadas cada.`}
      />
      <Toggle
        label="Assíncrona"
        checked={isAsync}
        onChange={(async) => update(edge.id, { async })}
        hint="A origem não espera a resposta, como ao publicar numa fila. Gera carga no destino, mas não soma no tempo de resposta do usuário."
      />
      {flow !== undefined && (
        <dl className="mini-stats">
          <div>
            <dt>Chamadas por segundo</dt>
            <dd>{formatNumber(flow)}</dd>
          </div>
        </dl>
      )}
      <button type="button" className="btn btn-danger" onClick={() => useEditor.getState().deleteLink(edge.id)}>
        <TrashIcon size={16} />
        Excluir ligação
      </button>
    </div>
  );
}

function MultiSelection({ count }: { count: number }) {
  return (
    <div className="props">
      <p className="empty-hint">{count} itens selecionados.</p>
      <button type="button" className="btn btn-danger" onClick={() => useEditor.getState().deleteSelection()}>
        <TrashIcon size={16} />
        Excluir selecionados
      </button>
    </div>
  );
}
