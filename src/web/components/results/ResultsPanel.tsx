import { useState } from 'react';
import { useEditor } from '../../store/editor.js';
import { ChevronIcon } from '../icons.js';
import { ComponentTable } from './ComponentTable.js';
import { ResponseCurve } from './ResponseCurve.js';

/** Painel inferior com a tabela de componentes e a curva de resposta. Pode ser recolhido. */
export function ResultsPanel() {
  const [open, setOpen] = useState(true);
  const empty = useEditor((s) => s.nodes.length === 0);
  if (empty) return null;
  return (
    <section className={`results${open ? '' : ' is-collapsed'}`} aria-label="Resultados">
      <div className="results-head">
        <button type="button" className="results-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <ChevronIcon size={16} className="results-chevron" />
          Resultados
        </button>
      </div>
      {open && (
        <div className="results-body">
          <div className="results-col results-table-col">
            <h3 className="sub-title">Componentes</h3>
            <ComponentTable />
          </div>
          <div className="results-col results-curve-col">
            <h3 className="sub-title">Curva de resposta</h3>
            <ResponseCurve />
          </div>
        </div>
      )}
    </section>
  );
}
