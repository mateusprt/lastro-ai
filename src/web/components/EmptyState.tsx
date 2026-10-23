import { TEMPLATES } from '../domain/templates.js';
import { useLoadDoc } from '../hooks/useLoadDoc.js';
import { useEditor } from '../store/editor.js';
import { useUi } from '../store/ui.js';

/** Canvas vazio: convite para começar por um modelo, sem tela em branco. */
export function EmptyState() {
  const empty = useEditor((s) => s.nodes.length === 0);
  const load = useLoadDoc();
  const openHelp = useUi((s) => s.openHelp);
  if (!empty) return null;

  return (
    <div className="empty-state">
      <div className="empty-card">
        <h2>Descubra até onde seu sistema aguenta</h2>
        <p>Desenhe as partes do seu sistema, diga quantos acessos chegam por segundo e veja qual parte trava primeiro.</p>
        <ol className="empty-steps">
          <li>Escolha um modelo abaixo ou arraste componentes da barra à esquerda.</li>
          <li>Ligue os componentes para mostrar quem chama quem.</li>
          <li>Ajuste os acessos na aba Simulação e acompanhe as cores: verde, amarelo e vermelho.</li>
        </ol>
        <div className="template-list">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="template" onClick={() => load(t.build())}>
              <span className="template-title">{t.title}</span>
              <span className="template-desc">{t.description}</span>
            </button>
          ))}
        </div>
        <button type="button" className="link-button empty-help" onClick={openHelp}>
          Nunca usou algo assim? Veja como funciona em um minuto.
        </button>
      </div>
    </div>
  );
}
