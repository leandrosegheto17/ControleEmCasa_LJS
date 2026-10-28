import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASAAS_URLS_PERMITIDAS, conferirAsaasUrl, main } from './conferir-asaas-url';

/**
 * O deploy só publica com `ASAAS_API_URL` (variável do environment `producao`) igual, caractere a caractere, ao
 * endereço de produção ou ao do sandbox do Asaas (publicacao-deploy T17; ADR-012; ADR-015). Qualquer outro valor,
 * inclusive vazio ou ausente, falha antes de qualquer passo de produção.
 */

const PRODUCAO = 'https://api.asaas.com/v3';
const SANDBOX = 'https://api-sandbox.asaas.com/v3';

afterEach(() => vi.restoreAllMocks());

describe('conferirAsaasUrl', () => {
  it('a lista permitida é exatamente produção e sandbox', () => {
    expect([...ASAAS_URLS_PERMITIDAS].sort()).toEqual([SANDBOX, PRODUCAO].sort());
  });

  it.each([PRODUCAO, SANDBOX])('aceita %s', (valor) => {
    expect(conferirAsaasUrl(valor)).toBe(valor);
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['só espaço', ' '],
    ['http em vez de https (produção)', 'http://api.asaas.com/v3'],
    ['http em vez de https (sandbox)', 'http://api-sandbox.asaas.com/v3'],
    ['host diferente', 'https://api.asaas.com.exemplo.invalid/v3'],
    ['outro host qualquer', 'https://asaas.teste.invalid/v3'],
    ['barra final (produção)', 'https://api.asaas.com/v3/'],
    ['barra final (sandbox)', 'https://api-sandbox.asaas.com/v3/'],
    ['espaço no fim', 'https://api.asaas.com/v3 '],
    ['espaço no início', ' https://api-sandbox.asaas.com/v3'],
    ['quebra de linha no fim', 'https://api.asaas.com/v3\n'],
    ['sem o /v3', 'https://api.asaas.com'],
    ['outra versão', 'https://api.asaas.com/v2'],
    ['maiúsculas', 'https://API.ASAAS.COM/v3'],
    ['com porta', 'https://api.asaas.com:443/v3'],
    ['com credencial', 'https://x@api.asaas.com/v3'],
  ])('recusa %s', (_rotulo, valor) => {
    expect(() => conferirAsaasUrl(valor)).toThrow(/ASAAS_API_URL/);
  });
});

describe('main (passo do deploy.yml)', () => {
  it.each([PRODUCAO, SANDBOX])('com %s devolve 0 e não emite ::error', (valor) => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(main({ ASAAS_API_URL: valor })).toBe(0);
    expect(erro).not.toHaveBeenCalled();
  });

  it.each([
    ['ausente', {}],
    ['vazio', { ASAAS_API_URL: '' }],
    ['http', { ASAAS_API_URL: 'http://api.asaas.com/v3' }],
    ['barra final', { ASAAS_API_URL: 'https://api.asaas.com/v3/' }],
  ])('valor %s: devolve 1 e emite ::error sem repetir o valor recebido', (_rotulo, ambiente) => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(main(ambiente)).toBe(1);
    expect(erro).toHaveBeenCalledTimes(1);
    const mensagem = String(erro.mock.calls[0]![0]);
    expect(mensagem).toMatch(/^::error title=[^:]+::/);
    expect(mensagem).toContain(PRODUCAO);
    expect(mensagem).toContain(SANDBOX);
    const recebido = (ambiente as { ASAAS_API_URL?: string }).ASAAS_API_URL;
    if (recebido) expect(mensagem).not.toContain(recebido);
  });
});

describe('comando no package.json', () => {
  it('conferir-asaas-url aponta para src/operacao/conferir-asaas-url.ts, e ele existe', () => {
    const raiz = join(import.meta.dirname, '../..');
    const { scripts } = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(scripts['conferir-asaas-url']).toBe('tsx src/operacao/conferir-asaas-url.ts');
    expect(existsSync(join(raiz, 'src/operacao/conferir-asaas-url.ts'))).toBe(true);
  });
});
