import { afterEach, describe, expect, it, vi } from 'vitest';
import { main, medirTempos, relatorio, resumir, rotaQueTocaBanco, ROTA_PADRAO } from './medir-retomada-a-frio';

/** RNF-05: primeira requisição que toca o banco (a frio) contra as seguintes. `/api/health` não serve. */
afterEach(() => vi.restoreAllMocks());

const COOKIE = '__Host-sid=segredo-da-sessao-123';

describe('resumir', () => {
  it('primeira contra a mediana das seguintes (quantidade ímpar e par)', () => {
    expect(resumir([900, 40, 60, 50])).toEqual({ primeiraMs: 900, medianaSeguintesMs: 50, diferencaMs: 850 });
    expect(resumir([500, 40, 60])).toEqual({ primeiraMs: 500, medianaSeguintesMs: 50, diferencaMs: 450 });
  });

  it('exige pelo menos uma seguinte', () => {
    expect(() => resumir([100])).toThrow(RangeError);
    expect(() => resumir([])).toThrow(RangeError);
  });

  it('a diferença pode ser negativa (primeira mais rápida) e o relatório a mostra', () => {
    const r = resumir([30, 50, 50]);
    expect(r.diferencaMs).toBe(-20);
    expect(relatorio(r, '/api/sessao')).toContain('custo da retomada a frio: -20 ms');
  });
});

describe('escolha da rota que toca o banco', () => {
  it('a padrão toca o banco; /api/health e rotas fora da lista não', () => {
    expect(rotaQueTocaBanco(ROTA_PADRAO)).toBe(true);
    expect(rotaQueTocaBanco('/api/contas?x=1')).toBe(true);
    expect(rotaQueTocaBanco('/api/health')).toBe(false);
    expect(rotaQueTocaBanco('/api/health?x=1')).toBe(false);
    expect(rotaQueTocaBanco('/')).toBe(false);
    expect(rotaQueTocaBanco('/api/qualquer-coisa')).toBe(false);
  });
});

describe('medirTempos e main (rede simulada)', () => {
  const ok = () => new Response('{}', { status: 200 });

  it('mede 1 + N requisições com o relógio injetado', async () => {
    const passos = [800, 50, 40, 60];
    // Cada requisição lê o relógio duas vezes (início e fim): o fim soma o passo da vez.
    const leituras: number[] = [];
    let acumulado = 0;
    passos.forEach((p) => {
      leituras.push(acumulado, acumulado + p);
      acumulado += p;
    });
    let k = 0;
    const tempos = await medirTempos({
      base: 'https://x.exemplo',
      rota: '/api/sessao',
      cookie: COOKIE,
      repeticoes: 3,
      fetch: async () => ok(),
      relogio: () => leituras[k++]!,
    });
    expect(tempos).toEqual(passos);
  });

  it('recusa rodar contra /api/health, sem fazer nenhuma requisição', async () => {
    const buscar = vi.fn(async () => ok());
    await expect(
      medirTempos({ base: 'https://x.exemplo', rota: '/api/health', cookie: COOKIE, fetch: buscar }),
    ).rejects.toThrow(/\/api\/health não serve/);
    expect(buscar).not.toHaveBeenCalled();

    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const codigo = await main({ URL_PUBLICA: 'https://x.exemplo', MEDIR_COOKIE: COOKIE }, ['/api/health'], buscar);
    expect(codigo).toBe(1);
    expect(buscar).not.toHaveBeenCalled();
    expect(erro.mock.calls.join(' ')).toContain('/api/health não serve');
  });

  it('sem cookie falha antes de qualquer requisição; resposta que não é 200 falha', async () => {
    const buscar = vi.fn(async () => ok());
    await expect(
      medirTempos({ base: 'https://x.exemplo', rota: '/api/sessao', cookie: '', fetch: buscar }),
    ).rejects.toThrow(/MEDIR_COOKIE ausente/);
    expect(buscar).not.toHaveBeenCalled();
    await expect(
      medirTempos({
        base: 'https://x.exemplo',
        rota: '/api/sessao',
        cookie: COOKIE,
        fetch: async () => new Response('', { status: 401 }),
      }),
    ).rejects.toThrow(/respondeu 401/);
  });

  it('main imprime o relatório (código 0) e nunca o cookie', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const amb = { URL_PUBLICA: 'https://x.exemplo/', MEDIR_COOKIE: COOKIE, REPETICOES: '3' };
    expect(await main(amb, [], async () => ok())).toBe(0);
    expect(info.mock.calls.join(' ')).toContain('custo da retomada a frio');
    expect(await main(amb, [], async () => new Response('', { status: 500 }))).toBe(1);
    expect(await main({ ...amb, URL_PUBLICA: '' }, [], async () => ok())).toBe(1);
    const tudo = [...info.mock.calls, ...erro.mock.calls].join(' ');
    expect(tudo).not.toContain(COOKIE);
  });
});
