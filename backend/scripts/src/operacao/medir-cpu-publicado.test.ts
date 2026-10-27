import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dentroDoTeto,
  lerResposta,
  main,
  medirPublicado,
  montarConsulta,
  relatorio,
  TETO_CPU_MS,
} from './medir-cpu-publicado';

/** RNF-04: CPU por requisição do Worker publicado, com teto de 10 ms. A API é simulada; a consulta real é da 17c. */
const TOKEN = 'tok_ABCDEF0123456789_segredo';
const CONTA = 'a'.repeat(32);

const corpo = (linha: unknown) => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: linha }] } } });
const resposta = (p50us: number, p99us: number, requests = 1200) =>
  corpo([{ sum: { requests, errors: 0 }, quantiles: { cpuTimeP50: p50us, cpuTimeP99: p99us } }]);
const json = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status });

afterEach(() => vi.restoreAllMocks());

describe('lerResposta', () => {
  it('caminho feliz: converte microssegundos em ms', () => {
    expect(lerResposta(resposta(1500, 8200))).toEqual({ requisicoes: 1200, p50Ms: 1.5, p99Ms: 8.2 });
  });

  it('janela sem dados (lista vazia ou zero requisições): null', () => {
    expect(lerResposta(corpo([]))).toBeNull();
    expect(lerResposta(resposta(0, 0, 0))).toBeNull();
  });

  it('erro da API (errors) lança com a mensagem; formato inesperado lança', () => {
    expect(() => lerResposta({ errors: [{ message: 'não autorizado' }], data: null })).toThrow(
      'A API de análise respondeu com erro: não autorizado',
    );
    expect(() => lerResposta({})).toThrow(/formato inesperado/);
    expect(() => lerResposta(null)).toThrow(/formato inesperado/);
    expect(() => lerResposta(corpo([{ sum: { requests: 5 }, quantiles: {} }]))).toThrow(/sem os quantis/);
  });
});

describe('regra do teto de 10 ms', () => {
  const m = (p50Ms: number, p99Ms: number) => ({ requisicoes: 1, p50Ms, p99Ms });

  it('passa até 10 ms inclusive e falha acima, em p50 ou p99', () => {
    expect(TETO_CPU_MS).toBe(10);
    expect(dentroDoTeto(m(2, 10))).toBe(true);
    expect(dentroDoTeto(m(2, 10.01))).toBe(false);
    expect(dentroDoTeto(m(10.5, 3))).toBe(false);
  });

  it('o relatório diz o veredito', () => {
    expect(relatorio(m(2, 8), 24)).toContain('DENTRO do teto');
    expect(relatorio(m(2, 12), 24)).toContain('ACIMA do teto');
  });
});

describe('consulta e main (API simulada)', () => {
  it('a consulta leva conta, script e a janela; o token só vai no cabeçalho', async () => {
    const agora = new Date('2026-10-27T12:00:00Z');
    const buscar = vi.fn().mockResolvedValue(json(resposta(1000, 2000)));
    await medirPublicado({ token: TOKEN, conta: CONTA, janelaHoras: 6, agora, fetch: buscar });
    const [url, init] = buscar.mock.calls[0]!;
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).not.toContain(TOKEN);
    expect(JSON.parse(init.body).variables).toEqual({
      conta: CONTA,
      script: 'controle-em-casa',
      desde: '2026-10-27T06:00:00.000Z',
      ate: '2026-10-27T12:00:00.000Z',
    });
    expect(montarConsulta({ conta: CONTA, script: 'x', desde: agora, ate: agora }).query).toContain('cpuTimeP99');
  });

  it('main: 0 dentro do teto, 1 acima, 1 sem dados', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const amb = { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: CONTA };
    expect(await main(amb, async () => json(resposta(1000, 9000)))).toBe(0);
    expect(await main(amb, async () => json(resposta(1000, 12000)))).toBe(1);
    expect(await main(amb, async () => json(corpo([])))).toBe(1);
  });

  it('main: token ou conta ausentes e HTTP de erro falham com mensagem', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main({}, async () => json({}))).toBe(1);
    expect(await main({ CLOUDFLARE_API_TOKEN: TOKEN }, async () => json({}))).toBe(1);
    expect(await main({ CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: CONTA }, async () => json({}, 403))).toBe(
      1,
    );
    const saida = erro.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(saida).toContain('CLOUDFLARE_API_TOKEN ausente');
    expect(saida).toContain('CLOUDFLARE_ACCOUNT_ID ausente');
    expect(saida).toContain('respondeu 403');
  });

  it('o token não aparece em nenhuma saída, nem quando a API o devolve na mensagem de erro', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const amb = { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: CONTA };
    await main(amb, async () => json({ errors: [{ message: `token ${TOKEN} inválido` }] }));
    await main(amb, async () => json(resposta(1000, 2000)));
    const tudo = [...info.mock.calls, ...erro.mock.calls].map((c) => c.join(' ')).join('\n');
    expect(tudo).not.toContain(TOKEN);
    expect(tudo).toContain('[removido]');
  });
});
