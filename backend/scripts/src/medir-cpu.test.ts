import { describe, expect, it } from 'vitest';
import { cpuDoProcStat, cpuPorRequisicao } from './medir-cpu';

/**
 * Medição de CPU (PLANO etapa 9; RNF-04 "< 10 ms de CPU por requisição"; risco R1): a CPU por requisição é o
 * delta da CPU do processo dividido pelo nº de requisições, descontada a referência sem banco.
 */
describe('cpuPorRequisicao', () => {
  it('delta ÷ n, e o líquido desconta a referência (nunca abaixo de 0)', () => {
    expect(cpuPorRequisicao({ cpuAntesMs: 1_000, cpuDepoisMs: 1_500, requisicoes: 100 })).toEqual({
      brutoMs: 5,
      liquidoMs: 5,
    });
    expect(cpuPorRequisicao({ cpuAntesMs: 1_000, cpuDepoisMs: 1_500, requisicoes: 100, referenciaMs: 2 })).toEqual({
      brutoMs: 5,
      liquidoMs: 3,
    });
    expect(cpuPorRequisicao({ cpuAntesMs: 0, cpuDepoisMs: 100, requisicoes: 100, referenciaMs: 2 }).liquidoMs).toBe(0);
  });

  it('n ≤ 0 é erro', () => {
    expect(() => cpuPorRequisicao({ cpuAntesMs: 0, cpuDepoisMs: 1, requisicoes: 0 })).toThrow(RangeError);
  });
});

describe('cpuDoProcStat (Linux)', () => {
  it('soma utime e stime (campos 14 e 15), mesmo com espaço e parênteses no nome do processo', () => {
    const stat = '4242 (work erd (x)) S 1 2 3 4 5 6 7 8 9 10 250 50 0 0 20 0 1 0 100 0 0';
    // utime 250 + stime 50 = 300 ticks a 100 Hz = 3 s.
    expect(cpuDoProcStat(stat)).toBe(3_000);
  });
});
