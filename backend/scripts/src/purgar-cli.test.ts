import { afterEach, describe, expect, it, vi } from 'vitest';
import { principal } from './purgar';

/**
 * Linha de comando da purga (padrão do Neon, ADR-017): a purga só roda contra o Neon e lê a URL de `NEON_URL_OWNER`.
 * `DATABASE_URL_*` fica para o banco local e de teste e não serve à purga. Nenhum teste aqui conecta a banco algum.
 */
describe('purgar: linha de comando', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sem NEON_URL_OWNER sai com 2 e registra a variável que falta, sem conectar', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await principal({})).toBe(2);
    const linha = JSON.parse(String(erro.mock.calls[0]?.[0])) as Record<string, string>;
    expect(linha).toMatchObject({ evento: 'purga_sem_banco', variavel: 'NEON_URL_OWNER' });
  });

  it('só com DATABASE_URL_OWNER (nome do banco local) também sai com 2: não cai no banco local', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await principal({ DATABASE_URL_OWNER: 'postgres://u:p@127.0.0.1:1/controle' })).toBe(2);
  });

  // Validação única do Neon (ADR-017, decisão 4): a purga recusa o destino antes de conectar.
  it.each([
    ['local', 'postgres://u:segredo@127.0.0.1:1/controle?sslmode=require', /local/],
    ['pooler', 'postgresql://u:segredo@ep-a-pooler.sa-east-1.aws.neon.tech/controle?sslmode=require', /-pooler/],
    ['fora do Neon', 'postgresql://u:segredo@db.exemplo.com/controle?sslmode=require', /\.neon\.tech/],
    ['sem TLS', 'postgresql://u:segredo@ep-a.sa-east-1.aws.neon.tech/controle', /sslmode/],
  ])('NEON_URL_OWNER %s: sai com 2 e registra o motivo, sem a senha', async (_n, url, motivo) => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await principal({ NEON_URL_OWNER: url })).toBe(2);
    const texto = String(erro.mock.calls[0]?.[0]);
    const linha = JSON.parse(texto) as Record<string, string>;
    expect(linha['evento']).toBe('purga_url_recusada');
    expect(linha['motivo']).toMatch(motivo);
    expect(texto).not.toContain('segredo');
  });
});
