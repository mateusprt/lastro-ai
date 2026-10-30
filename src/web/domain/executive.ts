import type { ComponentResult, ComponentStatus, ComponentType, SimulationResult } from '../../shared/simulation.js';
import type { DiagramDoc } from '../store/types.js';
import { formatBRL, formatNumber, formatPercent, formatRps } from './format.js';

/**
 * Relatório executivo: gargalo, data de saturação, cenários comparados,
 * recomendação e custo. As contas de fila vêm da API (uma simulação por
 * cenário); aqui ficam só a projeção de crescimento e a redação.
 *
 * A projeção é exata porque a capacidade não depende do tráfego: com
 * crescimento mensal g, os acessos chegam a um limite L em
 * meses = ln(L ÷ acessos de hoje) ÷ ln(1 + g).
 */

export const DEFAULT_MONTHLY_GROWTH = 0.05;
/** Crescimento máximo aceito no campo: 50% ao mês já multiplica os acessos por 130 em um ano. */
export const MAX_MONTHLY_GROWTH = 0.5;
export const HORIZON_MONTHS = 12;
export const PEAK_MULTIPLIER = 3;
/** Mesmo limite de tráfego do motor (GraphValidator). */
const MAX_TRAFFIC_RPS = 10_000_000;
const AVG_MONTH_MS = 30.436875 * 24 * 60 * 60 * 1000;

export type ScenarioKey = 'today' | 'six' | 'horizon' | 'peak' | 'reinforced';

export interface ScenarioPlan {
  key: ScenarioKey;
  label: string;
  description: string;
  trafficRps: number;
}

export function trafficAfter(rps: number, growth: number, months: number): number {
  return Math.min(MAX_TRAFFIC_RPS, rps * (1 + growth) ** months);
}

/** Cenários simulados antes de saber se é preciso reforço. */
export function scenarioPlans(rps: number, growth: number): ScenarioPlan[] {
  const pace = `Crescendo ${formatPercent(growth)} ao mês`;
  return [
    { key: 'today', label: 'Hoje', description: 'Os acessos de agora', trafficRps: rps },
    { key: 'six', label: 'Em 6 meses', description: pace, trafficRps: trafficAfter(rps, growth, 6) },
    { key: 'horizon', label: `Em ${HORIZON_MONTHS} meses`, description: pace, trafficRps: trafficAfter(rps, growth, HORIZON_MONTHS) },
    {
      key: 'peak',
      label: `Pico de ${PEAK_MULTIPLIER}×`,
      description: 'Um dia de pico sobre os acessos de hoje, como a Black Friday',
      trafficRps: Math.min(MAX_TRAFFIC_RPS, rps * PEAK_MULTIPLIER),
    },
  ];
}

export function reinforcedPlan(horizon: ScenarioPlan): ScenarioPlan {
  return {
    key: 'reinforced',
    label: `Em ${HORIZON_MONTHS} meses, com o reforço`,
    description: 'Com as instâncias recomendadas abaixo',
    trafficRps: horizon.trafficRps,
  };
}

/** Algum componente precisa de mais instâncias no horizonte. */
export function needsReinforcement(horizon: SimulationResult): boolean {
  return horizon.components.some((c) => c.reachable && c.additionalInstances > 0);
}

/** O diagrama com as instâncias recomendadas para o horizonte. */
export function reinforcedDoc(doc: DiagramDoc, horizon: SimulationResult): DiagramDoc {
  const byId = new Map(horizon.components.map((c) => [c.id, c]));
  return {
    ...doc,
    nodes: doc.nodes.map((n) => {
      const r = byId.get(n.id);
      return r && r.additionalInstances > 0 ? { ...n, data: { ...n.data, instances: r.requiredInstances } } : n;
    }),
  };
}

export type Saturation =
  | { kind: 'already' }
  | { kind: 'never'; reason: 'no-limit' | 'no-growth' }
  | { kind: 'date'; months: number; date: Date };

/** Quando os acessos, crescendo `growth` ao mês, chegam a `limitRps`. */
export function projectSaturation(rps: number, limitRps: number | null, growth: number, now: Date): Saturation {
  if (limitRps === null) return { kind: 'never', reason: 'no-limit' };
  if (rps >= limitRps) return { kind: 'already' };
  if (!(growth > 0) || !(rps > 0)) return { kind: 'never', reason: 'no-growth' };
  const months = Math.log(limitRps / rps) / Math.log(1 + growth);
  return { kind: 'date', months, date: new Date(now.getTime() + months * AVG_MONTH_MS) };
}

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

/** "março de 2027" ou uma frase curta quando não há data. */
export function formatSaturationDate(s: Saturation): string {
  if (s.kind === 'already') return 'Já passou';
  if (s.kind === 'never') return s.reason === 'no-limit' ? 'Sem limite' : 'Não chega';
  return monthYear.format(s.date);
}

/** "em cerca de 5 meses" */
export function formatSaturationDistance(s: Saturation): string {
  if (s.kind === 'already') return 'os acessos de hoje já passam do limite';
  if (s.kind === 'never') return s.reason === 'no-limit' ? 'nenhum componente com fila recebe acessos' : 'sem crescimento, os acessos não chegam ao limite';
  const m = s.months;
  if (m < 1) return 'em menos de 1 mês';
  if (m < 23.5) {
    const n = Math.round(m);
    return `em cerca de ${n} ${n === 1 ? 'mês' : 'meses'}`;
  }
  return `em cerca de ${formatNumber(Math.round((m / 12) * 10) / 10)} anos`;
}

export interface ScenarioRow extends ScenarioPlan {
  responseTimeMs: number | null;
  saturated: boolean;
  bottleneck: string | null;
  bottleneckUtilization: number | null;
  status: ComponentStatus;
  monthlyCost: number;
}

export interface CostRow {
  id: string;
  name: string;
  type: ComponentType;
  instancesToday: number;
  instancesRecommended: number;
  costToday: number;
  costRecommended: number;
}

export interface ExecutiveReport {
  title: string;
  generatedAt: string;
  growth: number;
  tone: ComponentStatus;
  summary: string;
  bottleneck: { name: string; utilization: number; status: ComponentStatus; maxEntryRps: number | null } | null;
  /** Quando os acessos chegam a 100% do gargalo. */
  saturation: Saturation;
  /** Quando passam da ocupação máxima aceitável. */
  safeLimit: Saturation;
  cost: { today: number; recommended: number; extra: number };
  actions: string[];
  scenarios: ScenarioRow[];
  costRows: CostRow[];
  assumptions: string[];
}

export interface ScenarioResults {
  today: SimulationResult;
  six: SimulationResult;
  horizon: SimulationResult;
  peak: SimulationResult;
  /** Só existe quando o horizonte pede reforço. */
  reinforced: SimulationResult | null;
}

export function buildExecutiveReport(doc: DiagramDoc, growth: number, results: ScenarioResults, now: Date): ExecutiveReport {
  const { today, horizon, reinforced } = results;
  const rps = today.input.trafficRps;
  const safe = today.input.safeUtilization;
  const plans = scenarioPlans(rps, growth);

  const b = bottleneckOf(today);
  const saturation = projectSaturation(rps, today.system.maxCapacityRps, growth, now);
  const safeLimit = projectSaturation(rps, today.system.safeCapacityRps, growth, now);

  const costToday = today.system.monthlyCost;
  const costRecommended = reinforced ? reinforced.system.monthlyCost : costToday;
  const extra = costRecommended - costToday;

  const scenarios: ScenarioRow[] = plans.map((p) => scenarioRow(p, results[p.key as Exclude<ScenarioKey, 'reinforced'>]));
  if (reinforced) scenarios.push(scenarioRow(reinforcedPlan(plans[2]!), reinforced));

  const reinforcedById = new Map((reinforced ?? today).components.map((c) => [c.id, c]));
  const costRows: CostRow[] = today.components.map((c) => {
    const r = reinforcedById.get(c.id) ?? c;
    return {
      id: c.id,
      name: c.name || 'Sem nome',
      type: c.type,
      instancesToday: c.instances,
      instancesRecommended: r.instances,
      costToday: c.monthlyCost,
      costRecommended: r.monthlyCost,
    };
  });

  return {
    title: doc.name.trim() || 'Diagrama sem nome',
    generatedAt: dateTime.format(now),
    growth,
    tone: toneFor(saturation, today),
    summary: summaryFor(b?.label ?? null, saturation, growth, costToday, costRecommended, horizon, reinforced),
    bottleneck: b ? { name: b.label, utilization: b.result.utilization, status: b.result.status, maxEntryRps: b.result.maxEntryRps } : null,
    saturation,
    safeLimit,
    cost: { today: costToday, recommended: costRecommended, extra },
    actions: actionsFor(results, growth),
    scenarios,
    costRows,
    assumptions: [
      `Crescimento de ${formatPercent(growth)} ao mês sobre os ${formatRps(rps)} de hoje. Ajuste no topo da página.`,
      `Ocupação máxima aceitável de ${formatPercent(safe)}: as instâncias recomendadas mantêm todos os componentes abaixo dela daqui a ${HORIZON_MONTHS} meses.`,
      `O pico de ${PEAK_MULTIPLIER}× aplica-se aos acessos de hoje, durante o tempo do pico.`,
      'Os custos usam o custo mensal por instância informado em cada componente do diagrama.',
      'É uma estimativa por teoria de filas. Bloqueios no banco (locks), limite de conexões e picos de poucos segundos não entram na conta; confirme com um teste de carga antes de decisões grandes.',
    ],
  };
}

function bottleneckOf(r: SimulationResult): { label: string; result: ComponentResult } | null {
  const c = r.system.bottleneckId ? r.components.find((x) => x.id === r.system.bottleneckId) : undefined;
  if (!c) return null;
  const name = c.name || 'Sem nome';
  const side = c.database?.limitedBy;
  return { label: side === 'primary' ? `${name} (primário)` : side === 'replicas' ? `${name} (réplicas)` : name, result: c };
}

function scenarioRow(plan: ScenarioPlan, r: SimulationResult): ScenarioRow {
  const b = bottleneckOf(r);
  return {
    ...plan,
    responseTimeMs: r.system.responseTimeMs,
    saturated: r.system.saturated,
    bottleneck: b?.label ?? null,
    bottleneckUtilization: b?.result.utilization ?? null,
    status: r.system.saturated ? 'critical' : (b?.result.status ?? 'ok'),
    monthlyCost: r.system.monthlyCost,
  };
}

function toneFor(saturation: Saturation, today: SimulationResult): ComponentStatus {
  if (saturation.kind === 'already' || today.system.saturated) return 'critical';
  if (saturation.kind === 'date' && saturation.months < 3) return 'critical';
  if (saturation.kind === 'date' && saturation.months < HORIZON_MONTHS) return 'warning';
  return 'ok';
}

function summaryFor(
  bottleneck: string | null,
  saturation: Saturation,
  growth: number,
  costToday: number,
  costRecommended: number,
  horizon: SimulationResult,
  reinforced: SimulationResult | null,
): string {
  const who = bottleneck ?? 'A arquitetura';
  const when =
    saturation.kind === 'already'
      ? `${who} já não dá conta dos acessos de hoje.`
      : saturation.kind === 'never'
        ? saturation.reason === 'no-limit'
          ? 'Nenhum componente com fila recebe acessos, então não há limite a projetar.'
          : `Sem crescimento, ${who} não chega ao limite.`
        : `No ritmo de ${formatPercent(growth)} ao mês, ${who} trava em ${monthYear.format(saturation.date)}, ${formatSaturationDistance(saturation)}.`;

  const primaryBound = horizon.components.some((c) => c.reachable && c.database?.primaryOverSafe);
  let plan: string;
  if (reinforced) {
    plan = `Para aguentar os próximos ${HORIZON_MONTHS} meses, o reforço recomendado custa ${formatBRL(costRecommended - costToday)} a mais por mês (de ${formatBRL(costToday)} para ${formatBRL(costRecommended)}).`;
  } else if (primaryBound) {
    plan = `Em ${HORIZON_MONTHS} meses, o primário do banco não dá conta das gravações, e mais instâncias não resolvem.`;
  } else {
    plan = `A arquitetura atual aguenta os próximos ${HORIZON_MONTHS} meses sem reforço, por ${formatBRL(costToday)} por mês.`;
  }
  if (reinforced && primaryBound) plan += ' Mesmo assim, o primário do banco continua no limite: veja a recomendação.';
  return `${when} ${plan}`;
}

function actionsFor(results: ScenarioResults, growth: number): string[] {
  const { horizon, peak, today } = results;
  const limit = formatPercent(horizon.input.safeUtilization);
  const actions: string[] = [];

  for (const c of horizon.components) {
    if (!c.reachable) continue;
    const name = c.name || 'Componente sem nome';
    if (c.database?.primaryOverSafe) {
      actions.push(
        `${name}: em ${HORIZON_MONTHS} meses as gravações sozinhas passam do limite do primário, e mais réplicas não resolvem. Planeje uma máquina maior para o primário, menos gravações (cache, lotes) ou dividir os dados entre bancos.`,
      );
      continue;
    }
    if (c.additionalInstances > 0) {
      const n = c.additionalInstances;
      const what = c.type === 'database' ? (n === 1 ? 'réplica' : 'réplicas') : n === 1 ? 'instância' : 'instâncias';
      actions.push(
        `Adicionar ${n} ${what} em ${name}, de ${c.instances} para ${c.requiredInstances}, por mais ${formatBRL(c.extraMonthlyCost)} por mês. Mantém ${name} abaixo de ${limit} de ocupação daqui a ${HORIZON_MONTHS} meses.`,
      );
    }
  }

  if (actions.length === 0) {
    actions.push(`Nenhum reforço é necessário nos próximos ${HORIZON_MONTHS} meses, crescendo ${formatPercent(growth)} ao mês.`);
  }

  const peakTrouble = peak.components.filter((c) => c.reachable && (c.saturated || c.status === 'critical')).map((c) => c.name || 'sem nome');
  if (peakTrouble.length > 0) {
    actions.push(
      `Um pico de ${PEAK_MULTIPLIER}× hoje (${formatRps(peak.input.trafficRps)}) deixaria ${joinList(peakTrouble)} acima do limite. Antes de datas de pico, planeje um reforço temporário.`,
    );
  } else if (today.system.safeCapacityRps !== null) {
    actions.push(`Um pico de ${PEAK_MULTIPLIER}× hoje cabe na arquitetura atual, que aguenta com folga até ${formatRps(today.system.safeCapacityRps)}.`);
  }
  return actions;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}
