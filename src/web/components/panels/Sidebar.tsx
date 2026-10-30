import { useEffect, useState } from 'react';
import { selectedEdge, selectedNode, useEditor } from '../../store/editor.js';
import { useUi } from '../../store/ui.js';
import { CollapseButton, SideRail } from '../SideCollapse.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import { SimulationPanel } from './SimulationPanel.js';

type Tab = 'simulation' | 'properties';

/**
 * Barra lateral com duas abas. Selecionar algo no diagrama abre as
 * propriedades; limpar a seleção volta para a simulação.
 */
export function Sidebar() {
  const selectionKey = useEditor((s) => selectedNode(s)?.id ?? selectedEdge(s)?.id ?? (s.nodes.some((n) => n.selected) || s.edges.some((e) => e.selected) ? 'multi' : null));
  const label = useEditor((s) => (selectedNode(s) ? 'Componente' : selectedEdge(s) ? 'Ligação' : 'Propriedades'));
  const [tab, setTab] = useState<Tab>('simulation');
  const open = useUi((s) => s.sidebarOpen);
  const toggle = useUi((s) => s.toggleSidebar);

  useEffect(() => {
    setTab(selectionKey ? 'properties' : 'simulation');
  }, [selectionKey]);

  if (!open) {
    return (
      <aside className="sidebar is-collapsed">
        <SideRail label={tab === 'simulation' ? 'Simulação' : label} side="right" onOpen={toggle} />
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="tabs">
        {/* Na borda voltada para o diagrama, como na barra da esquerda. Fica fora da lista de abas. */}
        <CollapseButton label="Painel lateral" side="right" onClick={toggle} />
        <div className="tab-list" role="tablist" aria-label="Painel lateral">
          <button type="button" role="tab" id="tab-sim" aria-selected={tab === 'simulation'} aria-controls="panel-sim" className="tab" onClick={() => setTab('simulation')}>
            Simulação
          </button>
          <button type="button" role="tab" id="tab-props" aria-selected={tab === 'properties'} aria-controls="panel-props" className="tab" onClick={() => setTab('properties')}>
            {label}
          </button>
        </div>
      </div>
      <div role="tabpanel" id="panel-sim" aria-labelledby="tab-sim" hidden={tab !== 'simulation'}>
        <SimulationPanel />
      </div>
      <div role="tabpanel" id="panel-props" aria-labelledby="tab-props" hidden={tab !== 'properties'}>
        <PropertiesPanel />
      </div>
    </aside>
  );
}
