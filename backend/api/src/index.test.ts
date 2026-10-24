import { describe, expect, it } from 'vitest';
import { app } from './index';

describe('GET /api/health', () => {
  it('responde 200 com ok verdadeiro', async () => {
    const resposta = await app.request('/api/health');
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
  });
});
