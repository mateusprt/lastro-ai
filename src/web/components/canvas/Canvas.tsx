import { useCallback, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type IsValidConnection,
} from '@xyflow/react';
import type { ComponentType } from '../../../shared/simulation.js';
import { connectionProblem } from '../../domain/graph.js';
import { useEditor } from '../../store/editor.js';
import type { LinkEdge } from '../../store/types.js';
import { ComponentNodeView } from './ComponentNodeView.js';
import { LinkEdgeView } from './LinkEdgeView.js';
import { DRAG_MIME } from './Palette.js';
import { FIT_VIEW } from '../../domain/viewport.js';

const nodeTypes = { component: ComponentNodeView };
const edgeTypes = { link: LinkEdgeView };
/** Sem a marca "React Flow" no canto do diagrama (permitido pela licença MIT). */
const PRO_OPTIONS = { hideAttribution: true } as const;
const defaultEdgeOptions = { type: 'link', markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } } as const;

export function Canvas({ children }: { children?: React.ReactNode }) {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const onConnect = useEditor((s) => s.onConnect);
  const { screenToFlowPosition } = useReactFlow();

  const isValidConnection: IsValidConnection<LinkEdge> = useCallback(
    (c) => connectionProblem(useEditor.getState().edges, c.source, c.target) === null,
    [],
  );

  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDrop = (e: DragEvent) => {
    const type = e.dataTransfer.getData(DRAG_MIME) as ComponentType;
    if (!type) return;
    e.preventDefault();
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Centraliza o nó (cerca de 212 × 130) no ponto onde foi solto.
    useEditor.getState().addComponent(type, { x: p.x - 106, y: p.y - 50 });
  };

  return (
    <div className="canvas" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        connectionLineType={ConnectionLineType.Bezier}
        deleteKeyCode={null}
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={0.25}
        maxZoom={2}
        snapToGrid
        snapGrid={[10, 10]}
        proOptions={PRO_OPTIONS}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      {children}
    </div>
  );
}
