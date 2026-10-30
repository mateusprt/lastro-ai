import type { SimulationInput, SimulationResult } from '../../shared/simulation.js';
import { request } from './http.js';

export function simulate(input: SimulationInput, signal?: AbortSignal): Promise<SimulationResult> {
  return request<SimulationResult>('/simulations', { method: 'POST', body: input, ...(signal ? { signal } : {}) });
}

/** Recurso ou limite que levou o usuário ao Plano Pro. Medimos qual motiva mais. */
export type ProFeature = 'header' | 'cost' | 'scenarios';

export function joinProWaitlist(feature: ProFeature): Promise<{ subscribed: boolean }> {
  return request('/waitlist/pro', { method: 'POST', body: { feature } });
}
