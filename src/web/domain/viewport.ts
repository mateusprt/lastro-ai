import type { FitViewOptions } from '@xyflow/react';

/** Enquadramento do diagrama: deixa espaço no topo para o diagnóstico, que fica sobre o canvas. */
export const FIT_VIEW: FitViewOptions = {
  padding: { top: '112px', bottom: '32px', left: '48px', right: '48px' },
  maxZoom: 1,
};
