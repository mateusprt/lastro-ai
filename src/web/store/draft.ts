import type { DiagramDoc } from './types.js';

/**
 * PROVISÓRIO: o diagrama fica guardado no navegador até existir o salvamento
 * na API (PUT /diagrams/:id). O editor grava; o relatório executivo, aberto em
 * outra aba, lê a mesma chave e acompanha as mudanças pelo evento `storage`.
 * Falhas de storage são ignoradas.
 */
export const DRAFT_KEY = 'lastro:draft:v1';

export function parseDraft(raw: string | null): DiagramDoc | null {
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as DiagramDoc;
    if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) return null;
    return doc;
  } catch {
    return null;
  }
}

export function loadDraft(): DiagramDoc | null {
  try {
    return parseDraft(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

/** Grava o diagrama. Devolve `false` se o navegador não deixar (modo privado, cota). */
export function saveDraft(doc: DiagramDoc): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}
