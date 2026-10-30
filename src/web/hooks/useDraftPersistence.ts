import { useEffect, useState } from 'react';
import { snapshot, useEditor } from '../store/editor.js';
import { saveDraft } from '../store/draft.js';

export type DraftStatus = 'idle' | 'saved' | 'unavailable';

export function useDraftPersistence(): DraftStatus {
  const [status, setStatus] = useState<DraftStatus>('idle');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.nodes === prev.nodes && s.edges === prev.edges && s.name === prev.name && s.entryPointId === prev.entryPointId && s.trafficRps === prev.trafficRps && s.safeUtilization === prev.safeUtilization) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        setStatus(saveDraft(snapshot(useEditor.getState())) ? 'saved' : 'unavailable');
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return status;
}
