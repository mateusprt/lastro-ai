import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { formatNumber } from '../../domain/format.js';
import { useEditor } from '../../store/editor.js';
import { useSimulation } from '../../store/simulation.js';
import type { LinkEdge } from '../../store/types.js';

function LinkEdgeViewImpl(props: EdgeProps<LinkEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd } = props;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const flow = useSimulation((s) => s.result?.links.find((l) => l.id === id)?.throughputRps);
  const stale = useSimulation((s) => s.stale);
  const calls = data?.callsPerRequest ?? 1;
  const isAsync = data?.async ?? false;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerEnd ? { markerEnd } : {})}
        className={`edge${isAsync ? ' edge-async' : ''}${selected ? ' is-selected' : ''}`}
        interactionWidth={24}
      />
      <EdgeLabelRenderer>
        <div
          className={`edge-label nodrag nopan${selected ? ' is-selected' : ''}${stale ? ' is-stale' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onClick={() => useEditor.getState().select(id, 'edge')}
        >
          {flow !== undefined && <span className="edge-flow">{formatNumber(flow)} req/s</span>}
          {(calls !== 1 || isAsync) && (
            <span className="edge-meta">
              {calls !== 1 && `×${formatNumber(calls)}`}
              {calls !== 1 && isAsync && ', '}
              {isAsync && 'assíncrona'}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const LinkEdgeView = memo(LinkEdgeViewImpl);
