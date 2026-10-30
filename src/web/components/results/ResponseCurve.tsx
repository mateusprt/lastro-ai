import { useId, useLayoutEffect, useState, type PointerEvent } from 'react';
import { formatMs, formatNumber, formatRps } from '../../domain/format.js';
import { useSimulation } from '../../store/simulation.js';

const H = 190;
const M = { top: 18, right: 16, bottom: 30, left: 52 };

function niceTicks(max: number, count: number): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/**
 * Curva tempo de resposta × tráfego de entrada, com os pontos devolvidos pela
 * API. Mostra onde está o tráfego atual e onde fica a capacidade segura.
 */
export function ResponseCurve() {
  const result = useSimulation((s) => s.result);
  const stale = useSimulation((s) => s.stale);
  const [chartEl, setChartEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // O relatório desenha uma segunda curva na mesma página: o recorte precisa de id único.
  const clipId = `plot-clip-${useId().replace(/:/g, '')}`;

  // Ref por callback: o contêiner só existe quando há resultado e o gráfico está visível.
  useLayoutEffect(() => {
    if (!chartEl) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry!.contentRect.width))));
    ro.observe(chartEl);
    return () => ro.disconnect();
  }, [chartEl]);

  if (!result) return <p className="empty-hint">A curva aparece quando houver um resultado de simulação.</p>;

  const pts = result.curve.filter((p): p is { trafficRps: number; responseTimeMs: number } => p.responseTimeMs !== null);
  if (pts.length < 2) return <p className="empty-hint">Não há pontos suficientes para desenhar a curva.</p>;

  const { system, input } = result;
  const xMax = pts.at(-1)!.trafficRps || 1;
  const base = pts[0]!.responseTimeMs;
  const current = system.responseTimeMs;
  const peak = Math.max(...pts.map((p) => p.responseTimeMs));
  // Perto da saturação o tempo dispara; cortamos o topo para o joelho continuar legível.
  const yCap = Math.min(peak, Math.max(base * 6, (current ?? 0) * 1.6));
  const yTicks = niceTicks(yCap, 4);
  const yMax = yTicks.at(-1)!;
  const xTicks = niceTicks(xMax, Math.max(3, Math.floor(width / 110))).filter((v) => v <= xMax);

  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const sx = (x: number) => M.left + (x / xMax) * iw;
  const sy = (y: number) => M.top + (1 - Math.min(y, yMax * 1.05) / yMax) * ih;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.trafficRps).toFixed(1)},${sy(p.responseTimeMs).toFixed(1)}`).join('');

  const safeX = system.safeCapacityRps;
  const currentInRange = input.trafficRps <= xMax && current !== null;
  const h = hover !== null ? pts[hover] : undefined;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * xMax;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i]!.trafficRps - x) < Math.abs(pts[best]!.trafficRps - x)) best = i;
    setHover(best);
  };

  return (
    <div className={`curve${stale ? ' is-stale' : ''}`}>
      <div className="curve-bar">
        <p className="curve-caption">
          {current === null
            ? `Com ${formatRps(input.trafficRps)} o sistema fica sobrecarregado. A curva vai até perto do máximo que ele aguenta.`
            : `Agora: ${formatMs(current)} com ${formatRps(input.trafficRps)}. A espera dispara perto de ${formatRps(system.maxCapacityRps)}.`}
        </p>
        <button type="button" className="btn btn-quiet btn-small" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>

      {asTable ? (
        <div className="table-wrap curve-table">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col" className="num">
                  Acessos
                </th>
                <th scope="col" className="num">
                  Tempo de resposta
                </th>
              </tr>
            </thead>
            <tbody>
              {pts
                .filter((_, i) => i % 5 === 0 || i === pts.length - 1)
                .map((p) => (
                  <tr key={p.trafficRps}>
                    <td className="num">{formatRps(p.trafficRps)}</td>
                    <td className="num">{formatMs(p.responseTimeMs)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={setChartEl}>
          <svg width={width} height={H} role="img" aria-label="Tempo de resposta conforme o tráfego de entrada aumenta">
            <defs>
              <clipPath id={clipId}>
                <rect x={M.left} y={M.top - 2} width={iw} height={ih + 2} />
              </clipPath>
            </defs>
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line className="grid" x1={M.left} x2={width - M.right} y1={sy(v)} y2={sy(v)} />
                <text className="tick" x={M.left - 8} y={sy(v) + 4} textAnchor="end">
                  {formatNumber(v)}
                </text>
              </g>
            ))}
            {xTicks.map((v) => (
              <text key={`x${v}`} className="tick" x={sx(v)} y={H - 10} textAnchor="middle">
                {formatNumber(v)}
              </text>
            ))}
            <text className="axis-unit" x={M.left} y={10}>
              tempo de resposta (ms)
            </text>
            <text className="axis-unit" x={width - M.right} y={H - 10} textAnchor="end">
              acessos (req/s)
            </text>

            {safeX !== null && safeX <= xMax && (
              <g>
                <line className="safe-line" x1={sx(safeX)} x2={sx(safeX)} y1={M.top} y2={M.top + ih} />
                <text className="safe-label" x={sx(safeX) - 6} y={M.top + 10} textAnchor="end">
                  limite com folga
                </text>
              </g>
            )}

            <path d={path} className="curve-line" clipPath={`url(#${clipId})`} />

            {currentInRange && (
              <g>
                <circle className="current-dot" cx={sx(input.trafficRps)} cy={sy(current)} r={5} />
                <text className="current-label" x={sx(input.trafficRps) + 9} y={sy(current) - 8}>
                  agora
                </text>
              </g>
            )}

            {h && (
              <g pointerEvents="none">
                <line className="crosshair" x1={sx(h.trafficRps)} x2={sx(h.trafficRps)} y1={M.top} y2={M.top + ih} />
                {h.responseTimeMs <= yMax * 1.05 && <circle className="hover-dot" cx={sx(h.trafficRps)} cy={sy(h.responseTimeMs)} r={4} />}
              </g>
            )}

            <rect
              x={M.left}
              y={M.top}
              width={iw}
              height={ih}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
          {h && (
            <div
              className="tooltip"
              style={{
                left: Math.min(sx(h.trafficRps) + 12, width - 150),
                top: M.top,
              }}
            >
              <strong>{formatMs(h.responseTimeMs)}</strong>
              <span>com {formatRps(h.trafficRps)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
