import { useEffect } from 'react';
import { ApiError } from '../http/http.js';
import { simulate } from '../http/endpoints.js';
import { toSimulationInput } from '../domain/graph.js';
import { useEditor } from '../store/editor.js';
import { useSimulation, type GraphIssue } from '../store/simulation.js';

const DEBOUNCE_MS = 300;

/**
 * Chama POST /simulations a cada edição relevante, com debounce, e cancela a
 * requisição anterior quando chega uma nova. Mover nós não dispara simulação.
 */
export function useAutoSimulation(): void {
  // Uma string estável: só muda quando muda algo que afeta o resultado.
  const key = useEditor((s) => {
    const input = toSimulationInput(s);
    return input ? JSON.stringify(input) : s.nodes.length === 0 ? 'empty' : 'no-entry';
  });

  useEffect(() => {
    const sim = useSimulation.getState();
    if (key === 'empty') {
      sim.reset();
      return;
    }
    if (key === 'no-entry') {
      sim.setIssues([{ code: 'UNKNOWN_ENTRY_POINT', message: 'Escolha qual componente recebe o tráfego de entrada.' }]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      sim.setLoading(true);
      simulate(JSON.parse(key), controller.signal)
        .then((result) => useSimulation.getState().setResult(result))
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          const s = useSimulation.getState();
          if (e instanceof ApiError && e.code === 'INVALID_GRAPH' && Array.isArray(e.details)) {
            s.setIssues(e.details as GraphIssue[]);
          } else if (e instanceof ApiError && e.code === 'INVALID_REQUEST') {
            s.setIssues([{ code: 'INVALID_REQUEST', message: 'Há valores inválidos no diagrama. Confira os campos dos componentes.' }]);
          } else {
            s.setError(e instanceof ApiError && e.status === 0 ? 'Sem conexão com o servidor. O resultado exibido pode estar desatualizado.' : 'Não foi possível calcular agora. Tente novamente em instantes.');
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
}
