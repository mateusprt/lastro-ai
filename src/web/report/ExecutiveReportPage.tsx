import { useEffect, useState } from 'react';
import { kindOf } from '../domain/catalog.js';
import {
  DEFAULT_MONTHLY_GROWTH,
  MAX_MONTHLY_GROWTH,
  buildExecutiveReport,
  formatSaturationDate,
  formatSaturationDistance,
  needsReinforcement,
  reinforcedDoc,
  scenarioPlans,
  type ExecutiveReport,
  type ScenarioResults,
} from '../domain/executive.js';
import { formatBRL, formatMs, formatPercent, formatRps } from '../domain/format.js';
import { toSimulationInput } from '../domain/graph.js';
import { ApiError } from '../http/http.js';
import { simulate } from '../http/endpoints.js';
import { DRAFT_KEY, loadDraft, parseDraft } from '../store/draft.js';
import type { DiagramDoc } from '../store/types.js';
import { NumberField } from '../components/fields.js';
import { CheckIcon, CriticalIcon, TypeIcon, WarnIcon } from '../components/icons.js';
import { StatusTag } from '../components/Status.js';

const GROWTH_KEY = 'lastro:report:growth';
const DEBOUNCE_MS = 300;

type Load =
  | { status: 'loading' }
  | { status: 'ready'; report: ExecutiveReport }
  | { status: 'error'; message: string };

/**
 * Relatório executivo, aberto em aba própria pelo botão do editor. Lê o
 * diagrama que o editor grava no navegador, simula os cenários na API e
 * acompanha as mudanças feitas no editor enquanto a aba está aberta.
 */
export function ExecutiveReportPage() {
  const [doc, setDoc] = useState<DiagramDoc | null>(loadDraft);
  const [growth, setGrowth] = useState(loadGrowth);
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  // O editor grava o diagrama a cada edição; o evento chega só nas outras abas.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFT_KEY) setDoc(parseDraft(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(GROWTH_KEY, String(growth));
    } catch {
      /* sem storage: só não lembramos entre visitas */
    }
  }, [growth]);

  useEffect(() => {
    document.title = doc?.name.trim() ? `Relatório executivo: ${doc.name.trim()}` : 'Relatório executivo';
  }, [doc?.name]);

  useEffect(() => {
    const input = doc ? toSimulationInput(doc) : null;
    if (!doc || !input) {
      setLoad({
        status: 'error',
        message: doc
          ? 'O diagrama ainda não tem um componente marcado para receber os acessos. Marque um no editor e o relatório se atualiza sozinho.'
          : 'Nenhum diagrama encontrado. Abra o relatório pelo botão "Relatório executivo" no editor.',
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoad((l) => (l.status === 'ready' ? l : { status: 'loading' }));
      runScenarios(doc, growth, controller.signal)
        .then((results) => setLoad({ status: 'ready', report: buildExecutiveReport(doc, growth, results, new Date()) }))
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setLoad({ status: 'error', message: errorMessage(e) });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [doc, growth]);

  return (
    <div className="report">
      <div className="report-toolbar">
        <div className="report-toolbar-text">
          <strong>Relatório executivo</strong>
        </div>
        <div className="report-growth">
          <NumberField
            label="Crescimento dos acessos por mês"
            unit="%"
            value={Math.round(growth * 1e6) / 1e4}
            min={0}
            max={MAX_MONTHLY_GROWTH * 100}
            onChange={(percent) => setGrowth(percent / 100)}
          />
        </div>
        <div className="report-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={load.status !== 'ready'}>
            Exportar para PDF
          </button>
        </div>
      </div>

      {load.status === 'ready' ? (
        <ReportSheet report={load.report} />
      ) : (
        <div className="report-sheet report-placeholder" role="status">
          {load.status === 'loading' ? 'Calculando os cenários…' : load.message}
        </div>
      )}
    </div>
  );
}

async function runScenarios(doc: DiagramDoc, growth: number, signal: AbortSignal): Promise<ScenarioResults> {
  const input = toSimulationInput(doc)!;
  const plans = scenarioPlans(doc.trafficRps, growth);
  const [today, six, horizon, peak] = await Promise.all(plans.map((p) => simulate({ ...input, trafficRps: p.trafficRps }, signal)));
  let reinforced = null;
  if (needsReinforcement(horizon!)) {
    const resized = toSimulationInput(reinforcedDoc(doc, horizon!))!;
    reinforced = await simulate({ ...resized, trafficRps: plans[2]!.trafficRps }, signal);
  }
  return { today: today!, six: six!, horizon: horizon!, peak: peak!, reinforced };
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError && (e.code === 'INVALID_GRAPH' || e.code === 'INVALID_REQUEST')) {
    return 'O diagrama tem problemas para resolver. Corrija no editor e o relatório se atualiza sozinho.';
  }
  if (e instanceof ApiError && e.status === 0) return 'Sem conexão com o servidor. Tente de novo em instantes.';
  return 'Não foi possível calcular o relatório agora. Tente de novo em instantes.';
}

function loadGrowth(): number {
  try {
    const n = Number(localStorage.getItem(GROWTH_KEY));
    if (localStorage.getItem(GROWTH_KEY) !== null && Number.isFinite(n) && n >= 0 && n <= MAX_MONTHLY_GROWTH) return n;
  } catch {
    /* sem storage */
  }
  return DEFAULT_MONTHLY_GROWTH;
}

function ReportSheet({ report: r }: { report: ExecutiveReport }) {
  const ToneIcon = r.tone === 'ok' ? CheckIcon : r.tone === 'warning' ? WarnIcon : CriticalIcon;

  return (
    <article className="report-sheet">
      <header className="report-head">
        <div className="report-brand">Lastro · Relatório executivo</div>
        <h1>{r.title}</h1>
        <p className="report-meta">{r.generatedAt}</p>
      </header>

      <section className={`report-verdict tone-${r.tone}`}>
        <ToneIcon size={22} className="report-verdict-icon" />
        <p>{r.summary}</p>
      </section>

      <dl className="report-numbers report-kpis">
        <div>
          <dt>Gargalo</dt>
          <dd>{r.bottleneck?.name ?? 'Nenhum'}</dd>
          {r.bottleneck && (
            <p>
              {formatPercent(r.bottleneck.utilization)} ocupado hoje · trava a partir de {formatRps(r.bottleneck.maxEntryRps)}
            </p>
          )}
        </div>
        <div>
          <dt>Data de saturação</dt>
          <dd>{formatSaturationDate(r.saturation)}</dd>
          <p>
            {capitalize(formatSaturationDistance(r.saturation))}
            {r.safeLimit.kind === 'date' && r.saturation.kind === 'date' && ` · passa do limite com folga em ${formatSaturationDate(r.safeLimit)}`}
          </p>
        </div>
        <div>
          <dt>Custo mensal hoje</dt>
          <dd>{formatBRL(r.cost.today)}</dd>
          <p>Soma de todas as instâncias do diagrama</p>
        </div>
        <div>
          <dt>Custo para aguentar 12 meses</dt>
          <dd>{formatBRL(r.cost.recommended)}</dd>
          <p>{r.cost.extra > 0 ? `${formatBRL(r.cost.extra)} a mais por mês` : 'Sem custo extra'}</p>
        </div>
      </dl>

      <section>
        <h2>Recomendação</h2>
        <ul className="report-list">
          {r.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Cenários comparados</h2>
        <div className="table-wrap report-table">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Cenário</th>
                <th scope="col" className="num">
                  Acessos
                </th>
                <th scope="col" className="num">
                  Tempo de resposta
                </th>
                <th scope="col">Gargalo</th>
                <th scope="col">Situação</th>
                <th scope="col" className="num">
                  Custo mensal
                </th>
              </tr>
            </thead>
            <tbody>
              {r.scenarios.map((s) => (
                <tr key={s.key} className={s.key === 'reinforced' ? 'report-row-highlight' : ''}>
                  <th scope="row">
                    <span className="report-row-name">
                      <span>
                        <span className="row-name">{s.label}</span>
                        <span className="row-kind">{s.description}</span>
                      </span>
                    </span>
                  </th>
                  <td className="num">{formatRps(s.trafficRps)}</td>
                  <td className="num">{s.responseTimeMs === null ? 'Sobrecarregado' : formatMs(s.responseTimeMs)}</td>
                  <td>
                    {s.bottleneck ?? 'Nenhum'}
                    {s.bottleneckUtilization !== null && <span className="row-kind">{formatPercent(s.bottleneckUtilization)} ocupado</span>}
                  </td>
                  <td>
                    <StatusTag status={s.status} saturated={s.saturated} />
                  </td>
                  <td className="num">{formatBRL(s.monthlyCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Custo por componente</h2>
        <div className="table-wrap report-table">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Componente</th>
                <th scope="col" className="num">
                  Instâncias
                </th>
                <th scope="col" className="num">
                  Custo hoje
                </th>
                <th scope="col" className="num">
                  Com o reforço
                </th>
              </tr>
            </thead>
            <tbody>
              {r.costRows.map((c) => {
                const changed = c.instancesRecommended !== c.instancesToday;
                return (
                  <tr key={c.id}>
                    <th scope="row">
                      <span className="report-row-name">
                        <TypeIcon type={c.type} size={16} />
                        <span>
                          <span className="row-name">{c.name}</span>
                          <span className="row-kind">{kindOf(c.type).label}</span>
                        </span>
                      </span>
                    </th>
                    <td className="num">
                      {c.instancesToday}
                      {changed && <span className="delta"> → {c.instancesRecommended}</span>}
                    </td>
                    <td className="num">{formatBRL(c.costToday)}</td>
                    <td className="num">{changed ? <strong>{formatBRL(c.costRecommended)}</strong> : formatBRL(c.costRecommended)}</td>
                  </tr>
                );
              })}
              <tr className="report-total">
                <th scope="row">Total</th>
                <td />
                <td className="num">{formatBRL(r.cost.today)}</td>
                <td className="num">{formatBRL(r.cost.recommended)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Premissas</h2>
        <ul className="report-list report-assumptions">
          {r.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
