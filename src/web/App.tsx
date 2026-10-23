import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/canvas/Canvas.js';
import { Palette } from './components/canvas/Palette.js';
import { DiagnosisBar } from './components/DiagnosisBar.js';
import { EmptyState } from './components/EmptyState.js';
import { HelpDialog } from './components/HelpDialog.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/panels/Sidebar.js';
import { ProDialog } from './components/ProDialog.js';
import { ResultsPanel } from './components/results/ResultsPanel.js';
import { useAutoSimulation } from './hooks/useAutoSimulation.js';
import { useDraftPersistence } from './hooks/useDraftPersistence.js';
import { useEditor } from './store/editor.js';
import { useUi } from './store/ui.js';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Atalhos: desfazer, refazer e excluir. Não interferem quando o foco está num campo. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) useEditor.getState().redo();
        else useEditor.getState().undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        useEditor.getState().redo();
      } else if (key === 'delete' || key === 'backspace') {
        useEditor.getState().deleteSelection();
      } else if (key === 'escape') {
        useEditor.getState().select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const draft = useDraftPersistence();
  useAutoSimulation();
  useShortcuts();
  const paletteOpen = useUi((s) => s.paletteOpen);
  const sidebarOpen = useUi((s) => s.sidebarOpen);

  return (
    <ReactFlowProvider>
      <div className={`app${paletteOpen ? '' : ' is-palette-collapsed'}${sidebarOpen ? '' : ' is-sidebar-collapsed'}`}>
        <Header draft={draft} />
        <Palette />
        <main className="stage">
          <Canvas>
            <DiagnosisBar />
            <EmptyState />
          </Canvas>
        </main>
        <Sidebar />
        <ResultsPanel />
      </div>
      <ProDialog />
      <HelpDialog />
    </ReactFlowProvider>
  );
}
