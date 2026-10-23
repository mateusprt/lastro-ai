import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY, type GlossaryKey } from '../domain/glossary.js';

const WIDTH = 280;

/**
 * Botão "?" que explica um termo do glossário. Abre ao clicar (funciona no
 * toque e no teclado) e fecha com Esc, clique fora ou rolagem. A explicação é
 * posicionada na tela, fora do fluxo, para não ser cortada por tabelas ou
 * painéis com rolagem.
 */
export function InfoTip({ term }: { term: GlossaryKey }) {
  const entry = GLOSSARY[term];
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const open = style !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setStyle(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !popover.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Não deixa o Esc chegar ao atalho global, que limparia a seleção do diagrama.
      e.stopPropagation();
      close();
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const toggle = () => {
    if (open || !button.current) {
      setStyle(null);
      return;
    }
    const r = button.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - 12, window.innerWidth - WIDTH - 8));
    const roomBelow = window.innerHeight - r.bottom;
    setStyle(roomBelow > 180 ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="info-tip"
        aria-label={`O que é ${entry.term.toLowerCase()}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={toggle}
      >
        ?
      </button>
      {open &&
        createPortal(
          <div ref={popover} id={id} role="tooltip" className="info-pop" style={{ ...style, width: WIDTH }}>
            <strong>{entry.term}</strong>
            <p>{entry.text}</p>
            {'example' in entry && <p className="info-example">{entry.example}</p>}
          </div>,
          document.body,
        )}
    </>
  );
}
