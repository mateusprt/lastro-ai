import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/hanken-grotesk';
import '@xyflow/react/dist/style.css';
import './styles/app.css';
import { App } from './App.js';
import { loadDraft } from './hooks/useDraftPersistence.js';
import { useEditor } from './store/editor.js';

const draft = loadDraft();
if (draft) useEditor.getState().loadDoc(draft, { resetHistory: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
