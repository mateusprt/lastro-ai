import { create } from 'zustand';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import type { ComponentType } from '../../shared/simulation.js';
import { kindOf } from '../domain/catalog.js';
import { connectionProblem } from '../domain/graph.js';
import { emptyDoc } from '../domain/templates.js';
import type { ComponentData, ComponentNode, DiagramDoc, LinkData, LinkEdge } from './types.js';

const HISTORY_LIMIT = 100;
/** Edições seguidas no mesmo campo dentro desta janela viram um único passo de desfazer. */
const COALESCE_MS = 1000;

interface History {
  past: DiagramDoc[];
  future: DiagramDoc[];
  lastKey: string | null;
  lastAt: number;
}

export interface EditorState extends DiagramDoc {
  history: History;
  dragging: boolean;

  onNodesChange: (changes: NodeChange<ComponentNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<LinkEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  addComponent: (type: ComponentType, position: XYPosition) => string;
  updateComponent: (id: string, patch: Partial<ComponentData>) => void;
  updateLink: (id: string, patch: Partial<LinkData>) => void;
  setEntryPoint: (id: string) => void;
  deleteSelection: () => void;
  deleteComponent: (id: string) => void;
  deleteLink: (id: string) => void;
  select: (id: string | null, kind?: 'node' | 'edge') => void;

  setName: (name: string) => void;
  setTraffic: (rps: number) => void;
  setSafeUtilization: (u: number) => void;

  loadDoc: (doc: DiagramDoc, opts?: { resetHistory?: boolean }) => void;
  undo: () => void;
  redo: () => void;
}

/** Cópia do documento sem estado de interface (seleção, arraste). */
export function snapshot(s: DiagramDoc): DiagramDoc {
  return {
    name: s.name,
    entryPointId: s.entryPointId,
    trafficRps: s.trafficRps,
    safeUtilization: s.safeUtilization,
    nodes: s.nodes.map(({ selected: _s, dragging: _d, ...n }) => ({ ...n, data: { ...n.data } })),
    edges: s.edges.map(({ selected: _s, ...e }) => ({ ...e, ...(e.data ? { data: { ...e.data } } : {}) })),
  };
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueName(base: string, nodes: ComponentNode[]): string {
  const names = new Set(nodes.map((n) => n.data.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

/** Escolhe um novo ponto de entrada quando o atual some: o primeiro balanceador, ou o primeiro nó. */
function fallbackEntry(nodes: ComponentNode[]): string | null {
  return (nodes.find((n) => n.data.type === 'load_balancer') ?? nodes[0])?.id ?? null;
}

export const useEditor = create<EditorState>()((set, get) => {
  /** Guarda o estado atual no histórico antes de uma mudança. */
  const record = (key: string | null = null) => {
    const { history } = get();
    const now = Date.now();
    if (key !== null && history.lastKey === key && now - history.lastAt < COALESCE_MS) {
      set({ history: { ...history, lastAt: now } });
      return;
    }
    set({
      history: {
        past: [...history.past, snapshot(get())].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: key,
        lastAt: now,
      },
    });
  };

  const removeNodes = (ids: Set<string>) => {
    const s = get();
    const nodes = s.nodes.filter((n) => !ids.has(n.id));
    const edges = s.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
    const entryPointId = s.entryPointId !== null && ids.has(s.entryPointId) ? fallbackEntry(nodes) : s.entryPointId;
    set({ nodes, edges, entryPointId });
  };

  return {
    ...emptyDoc(),
    history: { past: [], future: [], lastKey: null, lastAt: 0 },
    dragging: false,

    onNodesChange: (changes) => {
      // Exclusão é feita por deleteSelection (com histórico); ignoramos as do React Flow.
      const relevant = changes.filter((c) => c.type !== 'remove');
      const drag = relevant.find((c) => c.type === 'position');
      if (drag && drag.type === 'position') {
        if (drag.dragging && !get().dragging) {
          record();
          set({ dragging: true });
        } else if (!drag.dragging && get().dragging) {
          set({ dragging: false });
        }
      }
      set({ nodes: applyNodeChanges(relevant, get().nodes) });
    },

    onEdgesChange: (changes) => {
      set({ edges: applyEdgeChanges(changes.filter((c) => c.type !== 'remove'), get().edges) });
    },

    onConnect: ({ source, target }) => {
      const s = get();
      if (connectionProblem(s.edges, source, target)) return;
      record();
      const targetType = s.nodes.find((n) => n.id === target)?.data.type;
      const edge: LinkEdge = {
        id: newId('link'),
        type: 'link',
        source,
        target,
        // Quem chama uma fila normalmente não espera a resposta.
        data: { callsPerRequest: 1, async: targetType === 'queue' },
      };
      set({
        edges: [...s.edges.map((e) => ({ ...e, selected: false })), { ...edge, selected: true }],
        nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      });
    },

    addComponent: (type, position) => {
      record();
      const s = get();
      const kind = kindOf(type);
      const id = newId(type.replace('_', ''));
      const node: ComponentNode = {
        id,
        type: 'component',
        position,
        selected: true,
        data: { name: uniqueName(kind.label, s.nodes), type, ...kind.defaults },
      };
      set({
        nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), node],
        edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
        entryPointId: s.entryPointId ?? id,
      });
      return id;
    },

    updateComponent: (id, patch) => {
      record(`node:${id}:${Object.keys(patch).join(',')}`);
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) });
    },

    updateLink: (id, patch) => {
      record(`edge:${id}:${Object.keys(patch).join(',')}`);
      set({
        edges: get().edges.map((e) =>
          e.id === id ? { ...e, data: { callsPerRequest: 1, async: false, ...e.data, ...patch } } : e,
        ),
      });
    },

    setEntryPoint: (id) => {
      if (get().entryPointId === id) return;
      record();
      set({ entryPointId: id });
    },

    deleteSelection: () => {
      const s = get();
      const nodeIds = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id));
      const edgeIds = new Set(s.edges.filter((e) => e.selected).map((e) => e.id));
      if (nodeIds.size === 0 && edgeIds.size === 0) return;
      record();
      set({ edges: s.edges.filter((e) => !edgeIds.has(e.id)) });
      removeNodes(nodeIds);
    },

    deleteComponent: (id) => {
      record();
      removeNodes(new Set([id]));
    },

    deleteLink: (id) => {
      record();
      set({ edges: get().edges.filter((e) => e.id !== id) });
    },

    select: (id, kind = 'node') => {
      const s = get();
      set({
        nodes: s.nodes.map((n) => ({ ...n, selected: kind === 'node' && n.id === id })),
        edges: s.edges.map((e) => ({ ...e, selected: kind === 'edge' && e.id === id })),
      });
    },

    setName: (name) => {
      record('name');
      set({ name });
    },

    setTraffic: (rps) => {
      record('traffic');
      set({ trafficRps: rps });
    },

    setSafeUtilization: (u) => {
      record('safe');
      set({ safeUtilization: u });
    },

    loadDoc: (doc, { resetHistory = false } = {}) => {
      if (!resetHistory) record();
      set({
        ...snapshot(doc),
        ...(resetHistory ? { history: { past: [], future: [], lastKey: null, lastAt: 0 } } : {}),
      });
    },

    undo: () => {
      const { history } = get();
      const prev = history.past.at(-1);
      if (!prev) return;
      set({
        ...prev,
        history: { past: history.past.slice(0, -1), future: [snapshot(get()), ...history.future], lastKey: null, lastAt: 0 },
      });
    },

    redo: () => {
      const { history } = get();
      const next = history.future[0];
      if (!next) return;
      set({
        ...next,
        history: { past: [...history.past, snapshot(get())], future: history.future.slice(1), lastKey: null, lastAt: 0 },
      });
    },
  };
});

/** Componente selecionado, quando há exatamente um. */
export function selectedNode(s: Pick<EditorState, 'nodes'>): ComponentNode | null {
  const sel = s.nodes.filter((n) => n.selected);
  return sel.length === 1 ? sel[0]! : null;
}

export function selectedEdge(s: Pick<EditorState, 'edges'>): LinkEdge | null {
  const sel = s.edges.filter((e) => e.selected);
  return sel.length === 1 ? sel[0]! : null;
}
