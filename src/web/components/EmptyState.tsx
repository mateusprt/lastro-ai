import { TEMPLATES } from '../domain/templates.js';
import { useLoadDoc } from '../hooks/useLoadDoc.js';
import { useEditor } from '../store/editor.js';

/** Canvas vazio: convite para começar por um modelo, sem tela em branco. */
export function EmptyState() {
  const empty = useEditor((s) => s.nodes.length === 0);
  const load = useLoadDoc();
  if (!empty) return null;

  return (
    <div className="empty-state">
      <div className="empty-card">
        <h2>Desenhe sua arquitetura</h2>
        <p>Comece por um modelo pronto e veja na hora onde está o gargalo, ou arraste componentes da barra à esquerda.</p>
        <div className="template-list">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="template" onClick={() => load(t.build())}>
              <span className="template-title">{t.title}</span>
              <span className="template-desc">{t.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
