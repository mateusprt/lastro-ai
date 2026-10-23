import { useId } from 'react';
import { formatBRL, formatMs, formatMultiplier, formatPercent, formatRps, formatVolume } from '../../domain/format.js';
import type { GlossaryKey } from '../../domain/glossary.js';
import { useEditor } from '../../store/editor.js';
import { useSimulation } from '../../store/simulation.js';
import { useUi } from '../../store/ui.js';
import { FieldLabel, NumberField } from '../fields.js';
import { InfoTip } from '../InfoTip.js';
import { LockIcon } from '../icons.js';

/** Topo "redondo" para o controle deslizante de tráfego. */
function niceCeil(n: number): number {
  if (n <= 10) return 10;
  const p = 10 ** Math.floor(Math.log10(n));
  const f = n / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

export function SimulationPanel() {
  const traffic = useEditor((s) => s.trafficRps);
  const safe = useEditor((s) => s.safeUtilization);
  const setTraffic = useEditor((s) => s.setTraffic);
  const setSafe = useEditor((s) => s.setSafeUtilization);
  const result = useSimulation((s) => s.result);
  const stale = useSimulation((s) => s.stale);
  const sliderId = useId();
  const safeId = useId();

  const sys = result?.system;
  const maxCap = sys?.maxCapacityRps ?? null;
  const sliderMax = niceCeil(Math.max(traffic * 1.25, (maxCap ?? traffic) * 1.5, 10));
  const step = sliderMax >= 1000 ? 10 : sliderMax >= 100 ? 1 : 0.5;
  const bottleneck = result && sys?.bottleneckId ? result.components.find((c) => c.id === sys.bottleneckId) : undefined;

  return (
    <section className="panel simulation" aria-label="Simulação">
      <p className="panel-intro">Diga quantos acessos chegam e veja até onde a arquitetura aguenta. Os números se atualizam sozinhos.</p>

      <div className="traffic">
        <NumberField
          label="Acessos por segundo"
          unit="req/s"
          value={traffic}
          min={0}
          max={10_000_000}
          onChange={setTraffic}
          info="traffic"
          hint={formatVolume(traffic)}
        />
        <input
          id={sliderId}
          type="range"
          aria-label="Ajustar tráfego de entrada"
          min={0}
          max={sliderMax}
          step={step}
          value={Math.min(traffic, sliderMax)}
          onChange={(e) => setTraffic(Number(e.target.value))}
        />
      </div>

      <div className="field">
        <FieldLabel htmlFor={safeId} info="safeUtilization" aside={<output htmlFor={safeId}>{formatPercent(safe)}</output>}>
          Ocupação máxima aceitável
        </FieldLabel>
        <input id={safeId} type="range" min={50} max={95} step={5} value={Math.round(safe * 100)} onChange={(e) => setSafe(Number(e.target.value) / 100)} />
        <p className="field-hint">Quanto cada componente pode ficar ocupado sem risco. Acima disso ele fica vermelho. 80% é um bom padrão.</p>
      </div>

      {sys && (
        <dl className={`stats${stale ? ' is-stale' : ''}`}>
          <div className="stat">
            <StatTerm info="safeCapacity">Aguenta com folga até</StatTerm>
            <dd>{formatRps(sys.safeCapacityRps)}</dd>
            {sys.safeCapacityRps !== null && traffic > 0 && <p>{formatMultiplier(sys.safeCapacityRps / traffic)} os acessos de agora</p>}
          </div>
          <div className="stat">
            <StatTerm info="responseTime">Tempo de resposta</StatTerm>
            <dd>{sys.responseTimeMs === null ? 'Sobrecarregado' : formatMs(sys.responseTimeMs)}</dd>
            <p>{sys.responseTimeMs === null ? 'A espera cresce sem parar' : 'Quanto o usuário espera, em média'}</p>
          </div>
          <div className="stat">
            <StatTerm info="bottleneck">Gargalo</StatTerm>
            <dd className="stat-name">{bottleneck ? bottleneck.name || 'Sem nome' : 'Nenhum'}</dd>
            <p>{bottleneck ? `Trava a partir de ${formatRps(sys.maxCapacityRps)}` : 'Nada com fila recebe acessos'}</p>
          </div>
          {sys.hasBackgroundWork && (
            <div className="stat">
              <StatTerm info="background">Segundo plano</StatTerm>
              <dd>{sys.backgroundDelayMs === null ? 'Sobrecarregado' : formatMs(sys.backgroundDelayMs)}</dd>
              <p>Para terminar o que roda sem o usuário esperar</p>
            </div>
          )}
          <CostStat />
        </dl>
      )}
    </section>
  );
}

/** Título de um número do resumo, com o botão "?". */
function StatTerm({ info, children }: { info: GlossaryKey; children: string }) {
  return (
    <dt className="stat-term">
      {children}
      <InfoTip term={info} />
    </dt>
  );
}

/** A parte de custo é recurso do Plano Pro: aparece bloqueada e leva à lista de espera. */
function CostStat() {
  const openPro = useUi((s) => s.openPro);
  const extra = useSimulation((s) => s.result?.system.extraMonthlyCost ?? 0);
  // O valor só é usado para dizer se há custo extra, sem exibi-lo.
  const hasExtra = extra > 0;
  return (
    <div className="stat stat-locked">
      <dt>
        Custo mensal <span className="pro-badge">Pro</span>
      </dt>
      <dd>
        <button type="button" className="locked-value" onClick={() => openPro('cost')}>
          <LockIcon size={16} />
          {formatBRL(0).replace('0', '•••')}
        </button>
      </dd>
      <p>{hasExtra ? 'Veja quanto custa aguentar este cenário' : 'Veja o custo atual e o de cada cenário'}</p>
    </div>
  );
}
