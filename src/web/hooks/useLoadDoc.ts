import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';
import { FIT_VIEW } from '../domain/viewport.js';
import { useEditor } from '../store/editor.js';
import type { DiagramDoc } from '../store/types.js';

/** Carrega um documento (modelo ou vazio) e enquadra o diagrama na tela. */
export function useLoadDoc(): (doc: DiagramDoc) => void {
  const { fitView } = useReactFlow();
  return useCallback(
    (doc) => {
      useEditor.getState().loadDoc(doc);
      // Espera o React Flow medir os novos nós antes de enquadrar.
      requestAnimationFrame(() => requestAnimationFrame(() => void fitView({ ...FIT_VIEW, duration: 250 })));
    },
    [fitView],
  );
}
