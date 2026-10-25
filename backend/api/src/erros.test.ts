import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApp, CORPO_MAXIMO_BYTES } from './app';
import { ErroApi } from './erros';
import { chamar, ESCRITA } from './testes-suporte';

/** Critérios: G-46 (log sem dado pessoal, id de correlação), G-47 (500 sem stack/SQL), SDD 5.1 passo 2 e 7. */
const EMAIL = 'pessoa.secreta@exemplo.com';
const VALOR = '12345,67';

afterEach(() => vi.restoreAllMocks());

function appQueFalha() {
  return criarApp({
    rotas: (a) => {
      a.get('/api/_t/explode', () => {
        throw new Error(`falha ao salvar ${EMAIL} no valor ${VALOR}`);
      });
      a.get('/api/_t/negocio', () => {
        throw new ErroApi(409, 'nome_repetido', 'Já existe uma categoria com esse nome.');
      });
      a.get('/api/_t/consulta', async (c) => {
        await sql`select 1`.execute(c.get('db'));
        return c.json({ ok: true });
      });
      a.post('/api/_t/eco', async (c) => c.json({ bytes: (await c.req.text()).length }));
    },
  });
}

describe('onError', () => {
  it('devolve 500 erro_interno genérico, sem e-mail, valor, stack nem SQL, com id de correlação', async () => {
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await chamar(appQueFalha(), `/api/_t/explode?email=${EMAIL}`, { headers: { 'X-Teste': EMAIL } });
    const corpo = await r.text();
    expect(r.status).toBe(500);
    expect(JSON.parse(corpo)).toEqual({ code: 'erro_interno', message: expect.any(String), id: expect.any(String) });
    expect(corpo).not.toContain(EMAIL);
    expect(corpo).not.toContain(VALOR);
    expect(corpo).not.toMatch(/stack|select |insert /i);
    expect(r.headers.get('X-Request-Id')).toBe(JSON.parse(corpo).id);
    // o log tem o nome do erro e o id, nunca a mensagem
    const log = espiao.mock.calls.flat().join(' ');
    expect(log).toContain('erro_interno');
    expect(log).toContain('Error');
    expect(log).not.toContain(EMAIL);
    expect(log).not.toContain(VALOR);
  });

  it('erro de negócio sai no formato { code, message } com o status do código', async () => {
    const r = await chamar(appQueFalha(), '/api/_t/negocio');
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ code: 'nome_repetido', message: 'Já existe uma categoria com esse nome.' });
  });

  it('banco fora do ar vira 503 indisponivel, sem expor o endereço', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = await chamar(appQueFalha(), '/api/_t/consulta', undefined, {
      HYPERDRIVE: { connectionString: 'postgres://x:x@127.0.0.1:1/x' } as Hyperdrive,
    });
    const corpo = await r.text();
    expect(r.status).toBe(503);
    expect(JSON.parse(corpo)).toMatchObject({ code: 'indisponivel' });
    expect(corpo).not.toContain('127.0.0.1');
  });
});

describe('limite de corpo', () => {
  it('corpo acima de 64 KiB devolve 413 corpo_grande', async () => {
    const r = await chamar(appQueFalha(), '/api/_t/eco', {
      method: 'POST',
      headers: ESCRITA,
      body: 'x'.repeat(CORPO_MAXIMO_BYTES + 1),
    });
    expect(r.status).toBe(413);
    expect(await r.json()).toMatchObject({ code: 'corpo_grande' });
  });

  it('corpo no limite passa', async () => {
    const r = await chamar(appQueFalha(), '/api/_t/eco', {
      method: 'POST',
      headers: ESCRITA,
      body: 'x'.repeat(CORPO_MAXIMO_BYTES),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ bytes: CORPO_MAXIMO_BYTES });
  });
});
