import { autoscalingMax, autoscalingTarget, canAutoscale, hitRate, poolExtraHoldMs, poolSize, rateLimitRps } from '../../domain/advanced.js';
import { CATALOG, kindOf } from '../../domain/catalog.js';
import { describeCalls, describeComponent } from '../../domain/explain.js';
import { formatMs, formatNumber, formatPercent, formatRps } from '../../domain/format.js';
import type { GlossaryKey } from '../../domain/glossary.js';
import { selectedEdge, selectedNode, useEditor } from '../../store/editor.js';
import { useSimulation } from '../../store/simulation.js';
import type { ComponentData, ComponentNode, LinkEdge } from '../../store/types.js';
import { DEFAULT_WRITE_FRACTION, type ComponentType } from '../../../shared/simulation.js';
import { FieldLabel, NumberField, TextField, Toggle } from '../fields.js';
import { EntryIcon, TrashIcon, TypeIcon } from '../icons.js';
import { InfoTip } from '../InfoTip.js';
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
        <p className="empty-hint">Clique num componente ou numa ligação do diagrama para ver e ajustar os detalhes dele.</p>
      )}
    </section>
  );
}

function ComponentProperties({ node }: { node: ComponentNode }) {
  const update = useEditor((s) => s.updateComponent);
  const isEntry = useEditor((s) => s.entryPointId === node.id);
  const safe = useEditor((s) => s.safeUtilization);
  const r = useSimulation((s) => s.byId.get(node.id));
  const d = node.data;
  const external = d.type === 'external';
  const database = d.type === 'database';
  const db = r?.database;
  const advanced = useEditor((s) => s.advancedModeling);
  const autoscaled = advanced && canAutoscale(d) && d.autoscalingEnabled === true;
  const pooled = advanced && database && d.poolEnabled === true;

  return (
    <div className="props">
      {r && r.reachable && (
        <p className={`props-summary tone-${external && !r.rateLimit ? 'neutral' : r.status}`} aria-live="polite">
          {describeComponent(r, safe)}
        </p>
      )}
      {r && !r.reachable && (
        <p className="props-summary tone-neutral">
          Nenhum acesso chega aqui ainda. Ligue um componente que recebe acessos até este, puxando da bolinha à direita dele.
        </p>
      )}

      <TextField label="Nome" value={d.name} onChange={(name) => update(node.id, { name })} placeholder={kindOf(d.type).label} />

      <div className="field">
        <FieldLabel htmlFor="prop-type">Tipo</FieldLabel>
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
        <p className="field-hint">{kindOf(d.type).about}</p>
      </div>

      {external ? (
        <NumberField
          label="Tempo de resposta do serviço"
          unit="ms"
          value={d.serviceTimeMs}
          min={0}
          info="latency"
          onChange={(serviceTimeMs) => update(node.id, { serviceTimeMs })}
          hint="Quanto o serviço de terceiros leva para responder, em milissegundos (1.000 ms = 1 segundo)."
        />
      ) : (
        <>
          <NumberField
            label={autoscaled ? 'Mínimo de instâncias' : 'Instâncias'}
            value={d.instances}
            integer
            min={1}
            max={10000}
            info={database ? 'replicas' : 'instances'}
            onChange={(instances) => update(node.id, { instances })}
            hint={
              database
                ? `Com mais de uma, uma é o primário e recebe todas as gravações; as outras são réplicas e dividem as leituras. ${
                    pooled ? 'Bloqueios (locks) e atraso das réplicas' : 'Bloqueios (locks), limite de conexões e atraso das réplicas'
                  } não entram na conta, então o resultado pode ser otimista.`
                : autoscaled
                  ? 'O autoscaling nunca desliga abaixo disso. Também é o que fica ligado sem carga.'
                  : 'Quantas cópias deste componente rodam ao mesmo tempo, como servidores ou containers.'
            }
          />
          {database && (
            <NumberField
              label="Consultas que gravam dados"
              unit="%"
              value={toPercentField(d.writeFraction ?? DEFAULT_WRITE_FRACTION)}
              min={0}
              max={100}
              info="writeFraction"
              onChange={(percent) => update(node.id, { writeFraction: percent / 100 })}
              hint="Ex.: salvar um pedido ou editar um perfil. Todas vão para o primário, então mais réplicas não aumentam esse limite."
            />
          )}
          <NumberField
            label={database ? 'Tempo por consulta' : 'Tempo para atender uma requisição'}
            unit="ms"
            value={d.serviceTimeMs}
            min={0}
            exclusiveMin
            info="serviceTime"
            onChange={(serviceTimeMs) => update(node.id, { serviceTimeMs })}
            hint="Sem contar a espera na fila, em milissegundos (1.000 ms = 1 segundo). Se não souber, mantenha o valor sugerido."
          />
        </>
      )}

      {advanced && <AdvancedFields id={node.id} d={d} />}

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
            <EntryIcon size={16} />
            Os acessos dos usuários chegam por aqui.
            <InfoTip term="entryPoint" />
          </p>
        ) : (
          <div className="field-head">
            <button type="button" className="btn btn-quiet" onClick={() => useEditor.getState().setEntryPoint(node.id)}>
              <EntryIcon size={16} />
              Fazer os acessos chegarem por aqui
            </button>
            <InfoTip term="entryPoint" />
          </div>
        )}
      </div>

      {r && r.reachable && (
        <dl className="mini-stats">
          <Stat label="Recebe" info="throughput">
            {formatRps(r.throughputRps)}
          </Stat>
          {r.autoscaling && (
            <Stat label="Instâncias ligadas" info="autoscaling">
              {r.autoscaling.activeInstances} de {r.autoscaling.minInstances} a {r.autoscaling.maxInstances}
              {r.autoscaling.atMax && <span className="delta"> no máximo</span>}
            </Stat>
          )}
          {r.cache && (
            <Stat label="Acertos e faltas por segundo" info="hitRate">
              {formatNumber(r.cache.hitsRps)} e {formatNumber(r.cache.missesRps)}
            </Stat>
          )}
          {r.connectionPool && (
            <Stat label="Conexões em uso" info="connectionPool">
              {r.connectionPool.inUse === null ? 'Esgotadas' : `${formatNumber(r.connectionPool.inUse)} de ${r.connectionPool.size}`}{' '}
              <StatusTag status={r.connectionPool.status} saturated={r.connectionPool.saturated} />
            </Stat>
          )}
          {r.rateLimit && (
            <Stat label="Uso do limite do fornecedor" info="rateLimit">
              {formatPercent(r.rateLimit.utilization)} <StatusTag status={r.status} saturated={r.saturated} />
            </Stat>
          )}
          {db?.replicas && (
            <>
              <Stat label="Primário (gravações)" info="replicas">
                {formatPercent(db.primary.utilization)} <StatusTag status={db.primary.status} saturated={db.primary.saturated} />
              </Stat>
              <Stat label={db.replicas.servers === 1 ? 'Réplica (leituras)' : `${db.replicas.servers} réplicas (leituras)`}>
                {formatPercent(db.replicas.utilization)} <StatusTag status={db.replicas.status} saturated={db.replicas.saturated} />
              </Stat>
            </>
          )}
          {!external && !db?.replicas && (
            <Stat label="Ocupação" info="utilization">
              {formatPercent(r.utilization)} <StatusTag status={r.status} saturated={r.saturated} />
            </Stat>
          )}
          <Stat label="Tempo de resposta" info="responseTime">
            {r.saturated ? 'Sobrecarregado' : formatMs(r.responseTimeMs)}
          </Stat>
          {!external && (
            <Stat label={r.autoscaling ? 'Instâncias necessárias' : 'Instâncias recomendadas'} info="requiredInstances">
              {r.requiredInstances}
              {r.additionalInstances > 0 && <span className="delta"> (+{r.additionalInstances})</span>}
            </Stat>
          )}
        </dl>
      )}
      {r?.reachable && db?.primaryOverSafe && (
        <p className="props-warning">
          Só as gravações já passam do limite seguro do primário. Mais réplicas não resolvem: use uma máquina maior para o primário, reduza as
          gravações (cache, lotes) ou divida os dados entre bancos (particionamento).
        </p>
      )}

      <button type="button" className="btn btn-danger" onClick={() => useEditor.getState().deleteComponent(node.id)}>
        <TrashIcon size={16} />
        Excluir componente
      </button>
    </div>
  );
}

/**
 * Campos da modelagem avançada do tipo do componente. Os valores ficam guardados
 * mesmo com o recurso desligado, para o usuário poder ligar e desligar sem perdê-los.
 */
function AdvancedFields({ id, d }: { id: string; d: ComponentData }) {
  const update = useEditor((s) => s.updateComponent);
  const cacheFeedsSomething = useEditor((s) => s.edges.some((e) => e.source === id));

  let body: React.ReactNode = null;
  if (canAutoscale(d)) {
    body = (
      <>
        <Toggle
          label="Autoscaling"
          checked={d.autoscalingEnabled === true}
          info="autoscaling"
          onChange={(autoscalingEnabled) => update(id, { autoscalingEnabled })}
          hint={d.autoscalingEnabled ? undefined : 'Liga e desliga instâncias sozinho conforme a carga.'}
        />
        {d.autoscalingEnabled && (
          <>
            <NumberField
              label="Máximo de instâncias"
              value={autoscalingMax(d)}
              integer
              min={d.instances}
              max={10000}
              onChange={(autoscalingMax) => update(id, { autoscalingMax })}
              hint="A capacidade passa a ser a deste máximo."
            />
            <NumberField
              label="Ocupação-alvo"
              unit="%"
              value={toPercentField(autoscalingTarget(d))}
              min={5}
              max={95}
              info="autoscalingTarget"
              onChange={(percent) => update(id, { autoscalingTarget: percent / 100 })}
              hint="Quando a ocupação passa disso, o autoscaling liga mais instâncias."
            />
          </>
        )}
      </>
    );
  } else if (d.type === 'cache') {
    body = (
      <NumberField
        label="Taxa de acerto"
        unit="%"
        value={toPercentField(hitRate(d))}
        min={0}
        max={100}
        info="hitRate"
        onChange={(percent) => update(id, { hitRate: percent / 100 })}
        hint={
          cacheFeedsSomething
            ? 'Só as faltas seguem pelas ligações que saem do cache.'
            : 'Ligue o cache ao que ele protege (por exemplo, o banco) para as faltas seguirem até lá. Sem ligação de saída, a taxa não muda nada.'
        }
      />
    );
  } else if (d.type === 'database') {
    body = (
      <>
        <Toggle
          label="Limitar conexões (pool)"
          checked={d.poolEnabled === true}
          info="connectionPool"
          onChange={(poolEnabled) => update(id, { poolEnabled })}
          hint={d.poolEnabled ? undefined : 'Conta a espera por uma conexão livre quando o pool enche.'}
        />
        {d.poolEnabled && (
          <>
            <NumberField
              label="Conexões no pool"
              value={poolSize(d)}
              integer
              min={1}
              max={1_000_000}
              onChange={(poolSize) => update(id, { poolSize })}
              hint="O máximo de conexões abertas ao mesmo tempo (no Postgres, max_connections)."
            />
            <NumberField
              label="Tempo extra com a conexão"
              unit="ms"
              value={poolExtraHoldMs(d)}
              min={0}
              info="connectionHold"
              onChange={(poolExtraHoldMs) => update(id, { poolExtraHoldMs })}
              hint="Além do tempo da consulta: transações abertas, lógica entre consultas. Use 0 se a conexão é devolvida logo."
            />
          </>
        )}
      </>
    );
  } else if (d.type === 'external') {
    body = (
      <>
        <Toggle
          label="Limite de chamadas do fornecedor"
          checked={d.rateLimitEnabled === true}
          info="rateLimit"
          onChange={(rateLimitEnabled) => update(id, { rateLimitEnabled })}
          hint={d.rateLimitEnabled ? undefined : 'Conta o limite de chamadas por segundo do seu plano com o fornecedor.'}
        />
        {d.rateLimitEnabled && (
          <NumberField
            label="Chamadas por segundo permitidas"
            value={rateLimitRps(d)}
            min={0}
            exclusiveMin
            onChange={(rateLimitRps) => update(id, { rateLimitRps })}
            hint="Acima disso, o fornecedor recusa as chamadas."
          />
        )}
      </>
    );
  }
  if (body === null) return null;

  return (
    <fieldset className="props-advanced">
      <legend>Modelagem avançada</legend>
      {body}
    </fieldset>
  );
}

/** Linha de número do painel, com o botão "?" opcional ao lado do rótulo. */
function Stat({ label, info, children }: { label: string; info?: GlossaryKey; children: React.ReactNode }) {
  return (
    <div>
      <dt className="stat-term">
        {label}
        {info && <InfoTip term={info} />}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Fração para o campo em %, sem o ruído de ponto flutuante (0,3 × 100 = 30,000000000000004). */
function toPercentField(fraction: number): number {
  return Math.round(fraction * 1e6) / 1e4;
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
        info="callsPerRequest"
        onChange={(callsPerRequest) => update(edge.id, { callsPerRequest })}
        hint={`${describeCalls(calls)} Use 1 para sempre, 0,6 para 60% das vezes ou 2 para duas chamadas.`}
      />
      <Toggle
        label="Não espera a resposta (assíncrona)"
        checked={isAsync}
        info="async"
        onChange={(async) => update(edge.id, { async })}
        hint={
          isAsync
            ? 'A origem entrega o trabalho e segue em frente, como ao deixar uma mensagem numa fila. O usuário não espera por isso.'
            : 'Hoje a origem espera a resposta, e esse tempo soma no que o usuário espera.'
        }
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
