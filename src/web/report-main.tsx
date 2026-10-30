import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/hanken-grotesk';
import './styles/app.css';
import { ExecutiveReportPage } from './report/ExecutiveReportPage.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExecutiveReportPage />
  </StrictMode>,
);
