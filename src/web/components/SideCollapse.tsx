import { ChevronIcon } from './icons.js';

/** Faixa de uma barra lateral recolhida: clicar em qualquer ponto abre a barra. */
export function SideRail({ label, side, onOpen }: { label: string; side: 'left' | 'right'; onOpen: () => void }) {
  return (
    <button type="button" className="side-rail" aria-expanded={false} onClick={onOpen} title={`Mostrar ${label.toLowerCase()}`}>
      <ChevronIcon size={16} className={side === 'left' ? 'chevron-right' : 'chevron-left'} />
      <span className="rail-label">{label}</span>
    </button>
  );
}

/** Botão de recolher uma barra lateral, com a seta apontando para a borda. */
export function CollapseButton({ label, side, onClick }: { label: string; side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button type="button" className="icon-button collapse-button" aria-expanded onClick={onClick} aria-label={`Recolher ${label.toLowerCase()}`} title={`Recolher ${label.toLowerCase()}`}>
      <ChevronIcon size={16} className={side === 'left' ? 'chevron-left' : 'chevron-right'} />
    </button>
  );
}
