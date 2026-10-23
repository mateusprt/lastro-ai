import { create } from 'zustand';
import type { ProFeature } from '../http/endpoints.js';

interface UiState {
  /** Recurso que abriu o diálogo do Plano Pro, ou null se fechado. */
  proFeature: ProFeature | null;
  openPro: (feature: ProFeature) => void;
  closePro: () => void;
  /** Barras laterais abertas; recolhidas, viram uma faixa estreita. */
  paletteOpen: boolean;
  sidebarOpen: boolean;
  togglePalette: () => void;
  toggleSidebar: () => void;
  /** Janela "Como funciona" aberta. */
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

export const useUi = create<UiState>()((set) => ({
  paletteOpen: true,
  sidebarOpen: true,
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  proFeature: null,
  openPro: (proFeature) => set({ proFeature }),
  closePro: () => set({ proFeature: null }),
  helpOpen: false,
  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),
}));
