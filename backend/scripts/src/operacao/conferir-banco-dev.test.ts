import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from './conferir-banco';

/**
 * Branch `dev` do Neon (decisão do usuário em 2026-10-28, ADR-017): o `conferir-banco` aceita a `NEON_URL_DEV` com a
 * mesma validação única da `NEON_URL_OWNER`. Nenhum teste aqui conecta: as URLs são recusadas antes ou apontam para a
 * porta 1 do loopback.
 */
describe('conferir-banco com NEON_URL_DEV', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['local', 'postgres://u:segredo@127.0.0.1:1/controle?sslmode=require', /local/],
    ['pooler', 'postgresql://u:segredo@ep-a-pooler.sa-east-1.aws.neon.tech/controle?sslmode=require', /-pooler/],
    ['outro banco', 'postgresql://u:segredo@ep-a.sa-east-1.aws.neon.tech/neondb?sslmode=require', /controle/],
  ])('NEON_URL_DEV %s é recusada antes de conectar, citando a variável', async (_n, url, motivo) => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main({ NEON_URL_DEV: url })).toBe(1);
    const msg = erro.mock.calls.flat().join('\n');
    expect(msg).toMatch(motivo);
    expect(msg).toContain('NEON_URL_DEV');
    expect(msg).not.toMatch(/Não foi possível ler o banco/);
    expect(msg).not.toContain('segredo');
  });

  it('NEON_URL_DEV vale sobre a DATABASE_URL_OWNER local', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const local = 'postgres://u:p@127.0.0.1:1/controle';
    expect(await main({ NEON_URL_DEV: local, DATABASE_URL_OWNER: local })).toBe(1);
    expect(erro.mock.calls.flat().join('\n')).toContain('NEON_URL_DEV');
  });

  it('NEON_URL_OWNER e NEON_URL_DEV juntas são recusadas', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const url = 'postgresql://u:p@ep-a.sa-east-1.aws.neon.tech/controle?sslmode=require';
    expect(await main({ NEON_URL_OWNER: url, NEON_URL_DEV: url })).toBe(1);
    expect(erro.mock.calls.flat().join('\n')).toMatch(/ao mesmo tempo/);
  });
});
