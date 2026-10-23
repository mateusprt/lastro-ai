import { useEffect, useState } from 'react';
import { snapshot, useEditor } from '../store/editor.js';
import type { DiagramDoc } from '../store/types.js';

const KEY = 'lastro:draft:v1';

/**
 * PROVISÓRIO: guarda o diagrama no navegador até existir o salvamento
 * automático na API (PUT /diagrams/:id). Falhas de storage são ignoradas.
 */
export function loadDraft(): DiagramDoc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as DiagramDoc;
    if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) return null;
    return doc;
  } catch {
    return null;
  }
}

export type DraftStatus = 'idle' | 'saved' | 'unavailable';

export function useDraftPersistence(): DraftStatus {
  const [status, setStatus] = useState<DraftStatus>('idle');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.nodes === prev.nodes && s.edges === prev.edges && s.name === prev.name && s.entryPointId === prev.entryPointId && s.trafficRps === prev.trafficRps && s.safeUtilization === prev.safeUtilization) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(KEY, JSON.stringify(snapshot(useEditor.getState())));
          setStatus('saved');
        } catch {
          setStatus('unavailable');
        }
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return status;
}
