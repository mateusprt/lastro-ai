import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import { ecommerce } from '../engine/__tests__/fixtures.js';

let server: Server;
let base: string;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

function post(path: string, body: unknown, raw = false) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

describe('API', () => {
  it('GET /health', async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok' });
  });

  it('POST /simulations devolve o resultado do motor', async () => {
    const r = await post('/simulations', { graph: ecommerce(), entryPointId: 'lb', trafficRps: 100, safeUtilization: 0.8 });
    expect(r.status).toBe(200);
    const body = (await r.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.system.bottleneckId).toBe('app');
    expect(body.system.safeCapacityRps).toBeCloseTo(160, 9);
    expect(body.curve).toHaveLength(50);
  });

  it('400 para formato inválido, com os campos', async () => {
    const r = await post('/simulations', { graph: { components: [], links: [] }, entryPointId: 'lb', trafficRps: '100', safeUtilization: 0.8 });
    expect(r.status).toBe(400);
    const body = (await r.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.error.code).toBe('INVALID_REQUEST');
    const paths = body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain('graph.components');
    expect(paths).toContain('trafficRps');
  });

  it('422 com os problemas do diagrama quando o motor rejeita o grafo', async () => {
    const g = ecommerce();
    g.links.push({ source: 'db', target: 'lb', callsPerRequest: 1, async: false });
    const r = await post('/simulations', { graph: g, entryPointId: 'lb', trafficRps: 100, safeUtilization: 0.8 });
    expect(r.status).toBe(422);
    const body = (await r.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.error.code).toBe('INVALID_GRAPH');
    expect(body.error.details[0].code).toBe('CYCLE');
  });

  it('400 para JSON malformado', async () => {
    const r = await post('/simulations', '{"graph":', true);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe('INVALID_JSON');
  });

  it('404 em rota desconhecida', async () => {
    const r = await fetch(`${base}/nada`);
    expect(r.status).toBe(404);
  });

  it('POST /waitlist/pro inscreve', async () => {
    const r = await post('/waitlist/pro', { feature: 'cost' });
    expect(r.status).toBe(201);
  });
});
