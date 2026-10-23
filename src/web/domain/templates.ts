import { DEFAULT_WRITE_FRACTION, type ComponentType } from '../../shared/simulation.js';
import type { DiagramDoc } from '../store/types.js';

export interface Template {
  id: string;
  title: string;
  description: string;
  build: () => DiagramDoc;
}

type N = [id: string, name: string, type: ComponentType, instances: number, serviceTimeMs: number, cost: number, x: number, y: number, writeFraction?: number];
type L = [source: string, target: string, calls: number, async?: boolean];

function doc(name: string, entry: string, traffic: number, nodes: N[], links: L[]): DiagramDoc {
  return {
    name,
    entryPointId: entry,
    trafficRps: traffic,
    safeUtilization: 0.8,
    nodes: nodes.map(([id, label, type, instances, serviceTimeMs, monthlyCostPerInstance, x, y, writeFraction]) => ({
      id,
      type: 'component',
      position: { x, y },
      data: {
        name: label,
        type,
        instances,
        serviceTimeMs,
        monthlyCostPerInstance,
        ...(type === 'database' ? { writeFraction: writeFraction ?? DEFAULT_WRITE_FRACTION } : {}),
      },
    })),
    edges: links.map(([source, target, callsPerRequest, async = false]) => ({
      id: `${source}->${target}`,
      type: 'link',
      source,
      target,
      data: { callsPerRequest, async },
    })),
  };
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'ecommerce',
    title: 'E-commerce',
    description: 'Balanceador, API, cache, banco, gateway de pagamento e fila de pedidos.',
    build: () =>
      doc(
        'Loja virtual',
        'lb',
        100,
        [
          ['lb', 'Balanceador', 'load_balancer', 1, 1, 100, 0, 240],
          ['app', 'API da loja', 'app', 4, 20, 450, 290, 240],
          ['cache', 'Redis', 'cache', 1, 1, 350, 580, -10],
          ['pay', 'Gateway de pagamento', 'external', 1, 200, 0, 580, 130],
          ['queue', 'Fila de pedidos', 'queue', 1, 0.5, 50, 580, 500],
          ['worker', 'Processador de pedidos', 'worker', 2, 30, 300, 870, 500],
          ['db', 'Postgres', 'database', 2, 10, 1800, 1160, 300, 0.3],
        ],
        [
          ['lb', 'app', 1],
          ['app', 'cache', 1],
          ['app', 'db', 0.4],
          ['app', 'pay', 0.1],
          ['app', 'queue', 0.2, true],
          ['queue', 'worker', 1],
          ['worker', 'db', 2],
        ],
      ),
  },
  {
    id: 'api-queue',
    title: 'API com fila de processamento',
    description: 'API que responde rápido e envia o trabalho pesado para workers.',
    build: () =>
      doc(
        'API de relatórios',
        'lb',
        60,
        [
          ['lb', 'Balanceador', 'load_balancer', 1, 1, 100, 0, 180],
          ['api', 'API', 'app', 3, 15, 400, 290, 180],
          ['queue', 'Fila de jobs', 'queue', 1, 0.5, 50, 580, 360],
          ['worker', 'Gerador de relatórios', 'worker', 4, 400, 350, 870, 360],
          ['db', 'Postgres', 'database', 1, 8, 1500, 1160, 140],
          ['storage', 'Armazenamento de arquivos', 'external', 1, 80, 0, 1160, 400],
        ],
        [
          ['lb', 'api', 1],
          ['api', 'db', 0.5],
          ['api', 'queue', 0.3, true],
          ['queue', 'worker', 1],
          ['worker', 'db', 1],
          ['worker', 'storage', 1],
        ],
      ),
  },
];

export function emptyDoc(): DiagramDoc {
  return { name: 'Novo diagrama', nodes: [], edges: [], entryPointId: null, trafficRps: 100, safeUtilization: 0.8 };
}
