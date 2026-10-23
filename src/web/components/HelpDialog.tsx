import { useEffect, useRef } from 'react';
import { useUi } from '../store/ui.js';
import { CloseIcon } from './icons.js';

/** "Como funciona": o que o Lastro faz e como começar, em três passos. */
export function HelpDialog() {
  const open = useUi((s) => s.helpOpen);
  const close = useUi((s) => s.closeHelp);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog help-dialog" onClose={close} aria-labelledby="help-title">
      <button type="button" className="icon-button dialog-close" onClick={close} aria-label="Fechar">
        <CloseIcon size={18} />
      </button>
      <h2 id="help-title">Como o Lastro funciona</h2>
      <p>O Lastro estima quantos acessos a sua arquitetura aguenta e qual parte trava primeiro, antes de isso acontecer em produção.</p>

      <h3>Em três passos</h3>
      <ol className="help-steps">
        <li>
          <strong>Monte o diagrama.</strong> Comece por um modelo pronto ou arraste componentes da barra à esquerda. Para dizer quem chama quem, puxe
          da bolinha à direita de um componente até outro.
        </li>
        <li>
          <strong>Informe os acessos.</strong> Na aba Simulação, diga quantas requisições por segundo chegam. Clique num componente para ajustar
          instâncias e tempos; os valores sugeridos servem para começar.
        </li>
        <li>
          <strong>Leia as cores.</strong> <span className="tone-text-ok">Verde é folgado</span>,{' '}
          <span className="tone-text-warning">amarelo pede atenção</span> e <span className="tone-text-critical">vermelho está acima do limite</span>. O
          traço nos medidores marca a ocupação máxima aceitável.
        </li>
      </ol>
    </dialog>
  );
}
