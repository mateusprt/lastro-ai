import { diagnose } from '../domain/diagnosis.js';
import { useEditor } from '../store/editor.js';
import { useSimulation } from '../store/simulation.js';
import { CheckIcon, CriticalIcon, SpinnerIcon, WarnIcon } from './icons.js';

/** Diagnóstico em linguagem simples, sobre o canvas. */
export function DiagnosisBar() {
  const result = useSimulation((s) => s.result);
  const issues = useSimulation((s) => s.issues);
  const error = useSimulation((s) => s.error);
  const loading = useSimulation((s) => s.loading);
  const empty = useEditor((s) => s.nodes.length === 0);
  const select = useEditor((s) => s.select);

  if (empty) return null;

  const busy = loading && (
    <span className="diag-busy" role="status">
      <SpinnerIcon size={14} />
      Calculando
    </span>
  );

  if (issues.length > 0) {
    return (
      <div className="diagnosis tone-critical" role="alert">
        <CriticalIcon size={20} className="diag-icon" />
        <div className="diag-text">
          <p className="diag-headline">{issues.length === 1 ? 'O diagrama tem um problema para resolver.' : `O diagrama tem ${issues.length} problemas para resolver.`}</p>
          <ul className="diag-issues">
            {issues.slice(0, 4).map((i, k) => (
              <li key={k}>
                {i.componentIds?.[0] ? (
                  <button type="button" className="link-button" onClick={() => select(i.componentIds![0]!)}>
                    {i.message}
                  </button>
                ) : (
                  i.message
                )}
              </li>
            ))}
          </ul>
        </div>
        {busy}
      </div>
    );
  }

  if (!result) {
    return error ? (
      <div className="diagnosis tone-warning" role="alert">
        <WarnIcon size={20} className="diag-icon" />
        <p className="diag-headline">{error}</p>
      </div>
    ) : (
      <div className="diagnosis tone-neutral">{busy || <p className="diag-detail">Preparando a primeira simulação</p>}</div>
    );
  }

  const d = diagnose(result);
  const Icon = d.tone === 'ok' ? CheckIcon : d.tone === 'warning' ? WarnIcon : CriticalIcon;
  return (
    <div className={`diagnosis tone-${d.tone}`} aria-live="polite">
      <Icon size={20} className="diag-icon" />
      <div className="diag-text">
        <p className="diag-headline">{d.headline}</p>
        <p className="diag-detail">{error ?? d.detail}</p>
      </div>
      {busy}
    </div>
  );
}
