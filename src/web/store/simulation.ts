import { create } from 'zustand';
import type { ComponentResult, SimulationResult } from '../../shared/simulation.js';

/** Problema de validação devolvido pela API (422), no formato do motor. */
export interface GraphIssue {
  code: string;
  message: string;
  componentIds?: string[];
  linkIndex?: number;
}

export interface SimulationState {
  /** Último resultado válido. Continua visível enquanto um novo é calculado. */
  result: SimulationResult | null;
  byId: Map<string, ComponentResult>;
  loading: boolean;
  /** O resultado exibido não corresponde mais ao diagrama (houve erro depois dele). */
  stale: boolean;
  issues: GraphIssue[];
  issueIds: Set<string>;
  error: string | null;

  setLoading: (loading: boolean) => void;
  setResult: (result: SimulationResult) => void;
  setIssues: (issues: GraphIssue[]) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useSimulation = create<SimulationState>()((set) => ({
  result: null,
  byId: new Map(),
  loading: false,
  stale: false,
  issues: [],
  issueIds: new Set(),
  error: null,

  setLoading: (loading) => set({ loading }),
  setResult: (result) =>
    set({
      result,
      byId: new Map(result.components.map((c) => [c.id, c])),
      loading: false,
      stale: false,
      issues: [],
      issueIds: new Set(),
      error: null,
    }),
  setIssues: (issues) =>
    set({
      issues,
      issueIds: new Set(issues.flatMap((i) => i.componentIds ?? [])),
      loading: false,
      stale: true,
      error: null,
    }),
  setError: (error) => set({ error, loading: false, stale: true }),
  reset: () => set({ result: null, byId: new Map(), loading: false, stale: false, issues: [], issueIds: new Set(), error: null }),
}));
