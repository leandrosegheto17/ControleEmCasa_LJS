import { describe, expect, it, vi } from 'vitest';
import { criarApp } from './app';
import { ESCRITA } from './testes-suporte';
import { chamar } from './testes-suporte';

/**
 * Limite de taxa por IP (SDD 5.1 passo 3; G-20; CA-21.5): `LIMITE_ENTRAR` em entrar, `LIMITE_PUBLICO` em cadastro,
 * confirmar, reenviar e senha. O IP vem só de `CF-Connecting-IP`. Estoura antes do CSRF e do banco (nenhuma consulta).
 * Sem banco: o limite responde antes de qualquer conexão.
 */
function limiteFalso(permitir: boolean) {
  const chaves: string[] = [];
  const binding = {
    limit: async ({ key }: { key: string }) => {
      chaves.push(key);
      return { success: permitir };
    },
  } as unknown as RateLimit;
  return { binding, chaves };
}

const BANCO_FORA = { connectionString: 'postgres://x:x@127.0.0.1:1/x' } as Hyperdrive;

const ROTAS_PUBLICAS = [
  '/api/cadastro',
  '/api/cadastro/confirmar',
  '/api/cadastro/reenviar',
  '/api/senha/esqueci',
  '/api/senha/redefinir',
];

describe('limite de taxa', () => {
  it('entrar acima do LIMITE_ENTRAR: 429 muitas_requisicoes, chaveado pelo CF-Connecting-IP (X-Forwarded-For ignorado)', async () => {
    const entrar = limiteFalso(false);
    const publico = limiteFalso(true);
    const r = await chamar(
      criarApp(),
      '/api/sessao/entrar',
      {
        method: 'POST',
        headers: { ...ESCRITA, 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '198.51.100.1' },
        body: '{}',
      },
      { LIMITE_ENTRAR: entrar.binding, LIMITE_PUBLICO: publico.binding, HYPERDRIVE: BANCO_FORA },
    );
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ code: 'muitas_requisicoes' });
    expect(entrar.chaves).toEqual(['203.0.113.7']);
    expect(publico.chaves).toEqual([]);
  });

  it.each(ROTAS_PUBLICAS)('%s acima do LIMITE_PUBLICO: 429 muitas_requisicoes', async (rota) => {
    const publico = limiteFalso(false);
    const entrar = limiteFalso(true);
    const r = await chamar(
      criarApp(),
      rota,
      { method: 'POST', headers: { ...ESCRITA, 'CF-Connecting-IP': '203.0.113.9' }, body: '{}' },
      { LIMITE_ENTRAR: entrar.binding, LIMITE_PUBLICO: publico.binding, HYPERDRIVE: BANCO_FORA },
    );
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ code: 'muitas_requisicoes' });
    expect(publico.chaves).toEqual(['203.0.113.9']);
    expect(entrar.chaves).toEqual([]);
  });

  it('o limite vem antes do CSRF: mesmo sem o cabeçalho, quem estourou recebe 429', async () => {
    const r = await chamar(
      criarApp(),
      '/api/cadastro',
      { method: 'POST', body: '{}' },
      { LIMITE_PUBLICO: limiteFalso(false).binding, HYPERDRIVE: BANCO_FORA },
    );
    expect(r.status).toBe(429);
  });

  it('dentro do limite, a requisição segue (aqui até a validação: 400)', async () => {
    const r = await chamar(
      criarApp(),
      '/api/cadastro',
      { method: 'POST', headers: ESCRITA, body: '{}' },
      { LIMITE_PUBLICO: limiteFalso(true).binding, HYPERDRIVE: BANCO_FORA },
    );
    expect(r.status).toBe(400);
  });

  it('sem binding (local), não limita; em https registra a ausência sem dado pessoal', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = await chamar(
      criarApp(),
      '/api/cadastro',
      { method: 'POST', headers: { ...ESCRITA, 'CF-Connecting-IP': '203.0.113.50' }, body: '{}' },
      { LIMITE_PUBLICO: undefined, HYPERDRIVE: BANCO_FORA },
    );
    expect(r.status).toBe(400);
    const log = aviso.mock.calls.flat().join(' ');
    expect(log).toContain('limite_ausente');
    expect(log).not.toContain('203.0.113.50');
    aviso.mockRestore();
  });

  it('o wrangler.jsonc declara os bindings LIMITE_ENTRAR e LIMITE_PUBLICO', async () => {
    const { env } = await import('cloudflare:workers');
    expect(env.LIMITE_ENTRAR).toBeDefined();
    expect(env.LIMITE_PUBLICO).toBeDefined();
  });
});
