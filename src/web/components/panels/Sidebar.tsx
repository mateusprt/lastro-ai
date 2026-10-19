import { useEffect, useState } from 'react';
import { selectedEdge, selectedNode, useEditor } from '../../store/editor.js';
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

  useEffect(() => {
    setTab(selectionKey ? 'properties' : 'simulation');
  }, [selectionKey]);

  return (
    <aside className="sidebar">
      <div className="tabs" role="tablist" aria-label="Painel lateral">
        <button type="button" role="tab" id="tab-sim" aria-selected={tab === 'simulation'} aria-controls="panel-sim" className="tab" onClick={() => setTab('simulation')}>
          Simulação
        </button>
        <button type="button" role="tab" id="tab-props" aria-selected={tab === 'properties'} aria-controls="panel-props" className="tab" onClick={() => setTab('properties')}>
          {label}
        </button>
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
