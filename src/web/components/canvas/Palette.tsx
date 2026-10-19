import { useReactFlow } from '@xyflow/react';
import { CATALOG } from '../../domain/catalog.js';
import { useEditor } from '../../store/editor.js';
import { TypeIcon } from '../icons.js';

export const DRAG_MIME = 'application/x-lastro-component';

/** Barra de componentes: arraste para o canvas ou clique para adicionar no centro da tela. */
export function Palette() {
  const { screenToFlowPosition } = useReactFlow();

  const addAtCenter = (type: (typeof CATALOG)[number]['type']) => {
    const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
    const center = canvas ? { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 } : { x: 400, y: 300 };
    const p = screenToFlowPosition(center);
    // Pequeno deslocamento aleatório para nós adicionados em sequência não se empilharem.
    const jitter = () => Math.round((Math.random() - 0.5) * 80);
    useEditor.getState().addComponent(type, { x: p.x - 110 + jitter(), y: p.y - 50 + jitter() });
  };

  return (
    <nav className="palette" aria-label="Componentes">
      <h2 className="panel-title">Componentes</h2>
      <ul>
        {CATALOG.map((k) => (
          <li key={k.type}>
            <button
              type="button"
              className="palette-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, k.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => addAtCenter(k.type)}
              title={`Adicionar ${k.label.toLowerCase()}`}
              aria-label={`Adicionar ${k.label.toLowerCase()}`}
            >
              <span className="palette-icon">
                <TypeIcon type={k.type} />
              </span>
              <span className="palette-text">
                <span className="palette-label">{k.label}</span>
                <span className="palette-hint">{k.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="palette-help">Arraste para o diagrama. Para ligar dois componentes, puxe a partir da bolinha à direita de um deles.</p>
    </nav>
  );
}
