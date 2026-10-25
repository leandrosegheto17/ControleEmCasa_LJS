import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { chamar } from './testes-suporte';
import wranglerBruto from '../../../wrangler.jsonc?raw';

/** Critérios: PLANO etapa 3; SDD 5.1 (passo 1 e health sem banco, R5); G-35 e G-47; THREAT-MODEL TM-API-12. */
const BANCO_FORA = { HYPERDRIVE: { connectionString: 'postgres://x:x@127.0.0.1:1/x' } as Hyperdrive };

describe('GET /api/health', () => {
  it('pelo Worker real: 200 com { ok: true }', async () => {
    const r = await exports.default.fetch('https://teste.exemplo.local/api/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('não toca o banco: responde 200 mesmo com o Hyperdrive apontando para um endereço morto', async () => {
    const r = await chamar(criarApp(), '/api/health', undefined, BANCO_FORA);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});

describe('cabeçalhos de segurança em /api/*', () => {
  const esperados: Array<[string, RegExp]> = [
    ['Cache-Control', /^no-store$/],
    ['X-Content-Type-Options', /^nosniff$/],
    ['Referrer-Policy', /^no-referrer$/],
    ['Strict-Transport-Security', /max-age=\d{7,}/],
    ['Content-Security-Policy', /default-src 'none'.*frame-ancestors 'none'/],
    ['Permissions-Policy', /camera=\(\)/],
  ];

  it.each([
    ['health (200)', () => chamar(criarApp(), '/api/health')],
    ['rota inexistente (404)', () => chamar(criarApp(), '/api/nao-existe')],
    ['escrita sem CSRF (403)', () => chamar(criarApp(), '/api/qualquer', { method: 'POST' })],
    [
      'erro interno (500)',
      () =>
        chamar(
          criarApp({
            rotas: (a) =>
              a.get('/api/explode', () => {
                throw new Error('x');
              }),
          }),
          '/api/explode',
        ),
    ],
  ])('%s leva todos os cabeçalhos', async (_nome, chamada) => {
    const r = await chamada();
    for (const [nome, padrao] of esperados) {
      expect(r.headers.get(nome), nome).toMatch(padrao);
    }
  });

  it('nunca envia cabeçalhos CORS (G-21)', async () => {
    const r = await chamar(criarApp(), '/api/health', { headers: { Origin: 'https://outro.exemplo' } });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const pre = await chamar(criarApp(), '/api/lancamentos', {
      method: 'OPTIONS',
      headers: { Origin: 'https://outro.exemplo', 'Access-Control-Request-Method': 'POST' },
    });
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('o 404 da API é JSON com rota_inexistente', async () => {
    const r = await chamar(criarApp(), '/api/nao-existe');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ code: 'rota_inexistente', message: expect.any(String) });
  });
});

describe('wrangler.jsonc (PLANO etapa 3; G-32)', () => {
  it('tem assets com SPA e run_worker_first só para /api/*, nodejs_compat, Hyperdrive local e os três limites', () => {
    expect(wranglerBruto).toMatch(/"not_found_handling":\s*"single-page-application"/);
    expect(wranglerBruto).toMatch(/"run_worker_first":\s*\["\/api\/\*"\]/);
    expect(wranglerBruto).toMatch(/"compatibility_flags":\s*\["nodejs_compat"\]/);
    expect(wranglerBruto).toMatch(/"localConnectionString":\s*"postgres:\/\//);
    for (const nome of ['LIMITE_ENTRAR', 'LIMITE_PUBLICO', 'LIMITE_WEBHOOK']) {
      expect(wranglerBruto).toContain(`"name": "${nome}"`);
    }
  });

  it('não carrega segredo (chave com nome de segredo)', () => {
    expect(wranglerBruto).not.toMatch(/"[A-Z_]*(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DSN)[A-Z_]*"\s*:/);
  });
});
