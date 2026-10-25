import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { chamar, ESCRITA, ORIGEM } from './testes-suporte';

/** Critérios: G-21 (método sem o cabeçalho = 403; Origin alheio = 403; webhook é a exceção); SDD 5.1 passo 4. */
const app = criarApp({
  rotas: (a) => {
    a.all('/api/_t/escreve', (c) => c.body(null, 204));
    a.post('/api/webhooks/asaas', (c) => c.body(null, 204));
    a.post('/api/webhooks-falso', (c) => c.body(null, 204));
  },
});
const METODOS_ESCRITA = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

describe('CSRF por cabeçalho', () => {
  it.each(METODOS_ESCRITA)('%s sem o cabeçalho X-Controle-Em-Casa devolve 403 origem_invalida', async (metodo) => {
    const r = await chamar(app, '/api/_t/escreve', { method: metodo, headers: { Origin: ORIGEM } });
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: 'origem_invalida' });
  });

  it.each(METODOS_ESCRITA)('%s com Origin de outro site devolve 403 origem_invalida', async (metodo) => {
    const r = await chamar(app, '/api/_t/escreve', {
      method: metodo,
      headers: { 'X-Controle-Em-Casa': '1', Origin: 'https://atacante.exemplo' },
    });
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: 'origem_invalida' });
  });

  it.each(METODOS_ESCRITA)('%s sem Origin devolve 403', async (metodo) => {
    const r = await chamar(app, '/api/_t/escreve', { method: metodo, headers: { 'X-Controle-Em-Casa': '1' } });
    expect(r.status).toBe(403);
  });

  it('o cabeçalho com valor diferente de 1 é recusado', async () => {
    const r = await chamar(app, '/api/_t/escreve', {
      method: 'POST',
      headers: { 'X-Controle-Em-Casa': '0', Origin: ORIGEM },
    });
    expect(r.status).toBe(403);
  });

  it.each(METODOS_ESCRITA)('%s com o cabeçalho e a Origin certos passa', async (metodo) => {
    const r = await chamar(app, '/api/_t/escreve', { method: metodo, headers: ESCRITA });
    expect(r.status).toBe(204);
  });

  it('GET não exige o cabeçalho', async () => {
    const r = await chamar(app, '/api/_t/escreve');
    expect(r.status).toBe(204);
  });

  it('o webhook é a única exceção: passa sem cabeçalho nem Origin', async () => {
    const r = await chamar(app, '/api/webhooks/asaas', { method: 'POST' });
    expect(r.status).toBe(204);
  });

  it('a exceção do webhook não vale para outras rotas parecidas', async () => {
    const r = await chamar(app, '/api/webhooks-falso', { method: 'POST' });
    expect(r.status).toBe(403);
  });
});
