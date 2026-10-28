import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  API_CLOUDFLARE,
  conferirCacheDesligado,
  conferirRespostaDoCache,
  idDoHyperdrive,
  jsoncParaJson,
  main,
} from './cache-hyperdrive';

/**
 * O deploy só segue com o cache do Hyperdrive desligado (G-02 (e); SDD 5.3; TM-DB-02; ADR-015). Sem rede: `fetch`
 * simulado. Falha fechado em erro da API, JSON inválido, campo ausente, campo de outro tipo e id fictício.
 */

const ID = '0123456789abcdef0123456789abcdef';
const CONTA = 'fedcba9876543210fedcba9876543210';
const TOKEN = 'token_cloudflare-teste';

const wrangler = (id: string) => `// comentário com "aspas" e // barras
{
  "name": "x", /* bloco */
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "${id}", // id
      "localConnectionString": "postgres://controle_app:controle_app@localhost:5432/controle",
    },
  ],
}`;

function respondendo(status: number, corpo: unknown) {
  return vi.fn(
    async () =>
      new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('id do Hyperdrive no wrangler.jsonc', () => {
  it('lê o id do binding HYPERDRIVE (comentários e vírgulas finais do JSONC, sem estragar URLs em strings)', () => {
    expect(idDoHyperdrive(wrangler(ID))).toBe(ID);
    expect(JSON.parse(jsoncParaJson(wrangler(ID))).hyperdrive[0].localConnectionString).toContain('postgres://');
  });

  it('recusa o id fictício (só zeros), ausente ou fora do formato', () => {
    expect(() => idDoHyperdrive(wrangler('0'.repeat(32)))).toThrow(/fictício/);
    expect(() => idDoHyperdrive(wrangler('nao-e-hex'))).toThrow(/formato/);
    expect(() => idDoHyperdrive('{ "hyperdrive": [] }')).toThrow(/exatamente um/);
  });

  it('o wrangler.jsonc do repositório tem o id real do Hyperdrive (17b T6): com o fictício o deploy falharia', () => {
    const real = readFileSync(join(import.meta.dirname, '../../../../wrangler.jsonc'), 'utf8');
    const id = idDoHyperdrive(real);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toMatch(/^0+$/);
  });
});

describe('conferirRespostaDoCache', () => {
  it('passa só com success true e caching.disabled true', () => {
    expect(() => conferirRespostaDoCache({ success: true, result: { caching: { disabled: true } } })).not.toThrow();
  });

  it.each([
    ['cache ligado', { success: true, result: { caching: { disabled: false } } }],
    ['caching ausente', { success: true, result: {} }],
    ['disabled como texto', { success: true, result: { caching: { disabled: 'true' } } }],
    ['success falso', { success: false, result: { caching: { disabled: true } } }],
    ['nulo', null],
  ])('falha fechado: %s', (_nome, corpo) => {
    expect(() => conferirRespostaDoCache(corpo)).toThrow();
  });
});

describe('conferirCacheDesligado', () => {
  it('consulta a config pelo id e conta, com o token só no cabeçalho', async () => {
    const buscar = respondendo(200, { success: true, result: { caching: { disabled: true } } });
    await conferirCacheDesligado({ token: TOKEN, conta: CONTA, id: ID, fetch: buscar });
    const [url, init] = buscar.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`${API_CLOUDFLARE}/accounts/${CONTA}/hyperdrive/configs/${ID}`);
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('falha em resposta de erro, corpo que não é JSON e cache ligado', async () => {
    await expect(
      conferirCacheDesligado({ token: TOKEN, conta: CONTA, id: ID, fetch: respondendo(403, { success: false }) }),
    ).rejects.toThrow(/403/);
    await expect(
      conferirCacheDesligado({ token: TOKEN, conta: CONTA, id: ID, fetch: respondendo(200, 'html') }),
    ).rejects.toThrow(/JSON/);
    await expect(
      conferirCacheDesligado({
        token: TOKEN,
        conta: CONTA,
        id: ID,
        fetch: respondendo(200, { success: true, result: { caching: { disabled: false } } }),
      }),
    ).rejects.toThrow(/ligado/);
  });

  it('valida token e conta antes de chamar a API', async () => {
    const buscar = respondendo(200, {});
    await expect(conferirCacheDesligado({ token: '', conta: CONTA, id: ID, fetch: buscar })).rejects.toThrow();
    await expect(conferirCacheDesligado({ token: 'a b', conta: CONTA, id: ID, fetch: buscar })).rejects.toThrow();
    await expect(conferirCacheDesligado({ token: TOKEN, conta: '../x', id: ID, fetch: buscar })).rejects.toThrow();
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('main (ponto de entrada do deploy.yml)', () => {
  it('0 só com o cache desligado; 1 no resto, sem imprimir o token', async () => {
    const mensagens: string[] = [];
    const e = vi.spyOn(console, 'error').mockImplementation((m: string) => void mensagens.push(String(m)));
    const i = vi.spyOn(console, 'info').mockImplementation((m: string) => void mensagens.push(String(m)));
    try {
      const amb = { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: CONTA };
      const desligado = respondendo(200, { success: true, result: { caching: { disabled: true } } });
      expect(await main(amb, desligado, () => wrangler(ID))).toBe(0);
      const ligado = respondendo(200, { success: true, result: { caching: { disabled: false } } });
      expect(await main(amb, ligado, () => wrangler(ID))).toBe(1);
      expect(await main(amb, desligado, () => wrangler('0'.repeat(32)))).toBe(1);
    } finally {
      e.mockRestore();
      i.mockRestore();
    }
    for (const m of mensagens) expect(m).not.toContain(TOKEN);
  });
});
