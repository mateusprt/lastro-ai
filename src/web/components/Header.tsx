import { useEffect, useRef, useState } from 'react';
import { emptyDoc, TEMPLATES } from '../domain/templates.js';
import type { DraftStatus } from '../hooks/useDraftPersistence.js';
import { useLoadDoc } from '../hooks/useLoadDoc.js';
import { snapshot, useEditor } from '../store/editor.js';
import { useUi } from '../store/ui.js';
import { saveDraft } from '../store/draft.js';
import { useSimulation } from '../store/simulation.js';
import { ChevronIcon, HelpIcon, RedoIcon, ReportIcon, UndoIcon } from './icons.js';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export function Header({ draft }: { draft: DraftStatus }) {
  const name = useEditor((s) => s.name);
  const setName = useEditor((s) => s.setName);
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const openPro = useUi((s) => s.openPro);
  const openHelp = useUi((s) => s.openHelp);
  const hasResult = useSimulation((s) => s.result !== null);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-name">Lastro</span>
      </div>

      <input className="doc-name" aria-label="Nome do diagrama" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />

      <div className="topbar-group">
        <TemplatesMenu />
        <button type="button" className="icon-button" onClick={() => useEditor.getState().undo()} disabled={!canUndo} aria-label="Desfazer" title={`Desfazer (${MOD}+Z)`}>
          <UndoIcon />
        </button>
        <button type="button" className="icon-button" onClick={() => useEditor.getState().redo()} disabled={!canRedo} aria-label="Refazer" title={`Refazer (${MOD}+Shift+Z)`}>
          <RedoIcon />
        </button>
        <span className="draft-status" role="status">
          {draft === 'saved' ? 'Rascunho salvo neste navegador' : draft === 'unavailable' ? 'Não foi possível salvar o rascunho' : ''}
        </span>
      </div>

      <div className="topbar-group topbar-end">
        {/* TESTE: aberto a todos enquanto o app não está no ar; depois vira recurso do Plano Pro. */}
        <button
          type="button"
          className="btn"
          onClick={openExecutiveReport}
          disabled={!hasResult}
          title={
            hasResult
              ? 'Abre numa nova aba: gargalo, data de saturação, cenários, recomendação e custo'
              : 'Monte um diagrama com ponto de entrada para gerar o relatório'
          }
        >
          <ReportIcon size={18} />
          Relatório executivo
        </button>
        <button type="button" className="btn btn-quiet" onClick={openHelp}>
          <HelpIcon size={18} />
          Como funciona
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => openPro('scenarios')}>
          Cenários <span className="pro-badge">Pro</span>
        </button>
        <button type="button" className="btn btn-pro" onClick={() => openPro('header')}>
          Plano Pro em breve
        </button>
      </div>
    </header>
  );
}

/**
 * Grava o diagrama agora (sem esperar o rascunho automático) e abre o relatório
 * em outra aba, que lê o mesmo rascunho.
 */
function openExecutiveReport() {
  saveDraft(snapshot(useEditor.getState()));
  window.open('/relatorio.html', '_blank', 'noopener');
}

function TemplatesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const load = useLoadDoc();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (build: () => ReturnType<typeof emptyDoc>) => {
    load(build());
    setOpen(false);
  };

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn btn-quiet" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        Modelos <ChevronIcon size={16} />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="menuitem" className="menu-item" onClick={() => choose(t.build)}>
              <span className="menu-item-title">{t.title}</span>
              <span className="menu-item-desc">{t.description}</span>
            </button>
          ))}
          <button type="button" role="menuitem" className="menu-item" onClick={() => choose(emptyDoc)}>
            <span className="menu-item-title">Diagrama em branco</span>
            <span className="menu-item-desc">Você pode desfazer e voltar ao diagrama atual.</span>
          </button>
        </div>
      )}
    </div>
  );
}
