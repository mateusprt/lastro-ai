import { useEffect, useRef, useState } from 'react';
import { joinProWaitlist } from '../http/endpoints.js';
import { useUi } from '../store/ui.js';
import { CheckIcon, CloseIcon } from './icons.js';

const SUBSCRIBED_KEY = 'lastro:pro-waitlist';

function wasSubscribed(): boolean {
  try {
    return localStorage.getItem(SUBSCRIBED_KEY) === '1';
  } catch {
    return false;
  }
}

const INTRO: Record<string, string> = {
  header: 'O Plano Pro é para quem leva o resultado e planeja com frequência.',
  cost: 'O custo da arquitetura e de cada cenário faz parte do Plano Pro.',
  scenarios: 'Salvar e comparar cenários, como "Black Friday 3×", faz parte do Plano Pro.',
};

/** Diálogo "Plano Pro em breve": inscreve na lista de espera e registra o recurso que motivou o clique. */
export function ProDialog() {
  const feature = useUi((s) => s.proFeature);
  const close = useUi((s) => s.closePro);
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(() => (wasSubscribed() ? 'done' : 'idle'));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (feature && !d.open) d.showModal();
    if (!feature && d.open) d.close();
  }, [feature]);

  const subscribe = async () => {
    if (!feature) return;
    setState('sending');
    try {
      await joinProWaitlist(feature);
      try {
        localStorage.setItem(SUBSCRIBED_KEY, '1');
      } catch {
        /* sem storage: só não lembramos entre visitas */
      }
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={close} aria-labelledby="pro-title">
      <button type="button" className="icon-button dialog-close" onClick={close} aria-label="Fechar">
        <CloseIcon size={18} />
      </button>
      <h2 id="pro-title">Plano Pro em breve</h2>
      <p>{INTRO[feature ?? 'header']}</p>
      <ul className="pro-list">
        <li>Diagramas maiores e ilimitados</li>
        <li>Cenários comparados lado a lado</li>
        <li>Custo atual e custo extra de cada cenário</li>
      </ul>
      {state === 'done' ? (
        <p className="pro-done">
          <CheckIcon size={18} />
          Você está na lista de espera. Avisamos quando o Pro abrir.
        </p>
      ) : (
        <div className="dialog-actions">
          {state === 'error' && <p className="field-error">Não deu para entrar na lista agora. Tente de novo em instantes.</p>}
          <button type="button" className="btn btn-primary" onClick={subscribe} disabled={state === 'sending'}>
            {state === 'sending' ? 'Entrando na lista' : 'Entrar na lista de espera'}
          </button>
        </div>
      )}
    </dialog>
  );
}
