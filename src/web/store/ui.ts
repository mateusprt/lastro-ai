import { create } from 'zustand';
import type { ProFeature } from '../http/endpoints.js';

interface UiState {
  /** Recurso que abriu o diálogo do Plano Pro, ou null se fechado. */
  proFeature: ProFeature | null;
  openPro: (feature: ProFeature) => void;
  closePro: () => void;
}

export const useUi = create<UiState>()((set) => ({
  proFeature: null,
  openPro: (proFeature) => set({ proFeature }),
  closePro: () => set({ proFeature: null }),
}));
