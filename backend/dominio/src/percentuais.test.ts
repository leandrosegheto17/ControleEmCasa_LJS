import { describe, expect, it } from 'vitest';
import { pagoPorMembro } from './percentuais';

const A = 'membro-a';
const B = 'membro-b';
const m = (membroId: string, valorCentavos: number) => ({ membroId, valorCentavos });

// Casos portados de MyMoney/backend/supabase/tests/totais/totais_conjunto.sql e CA-16.1 a CA-16.3.
describe('pagoPorMembro (RN-16a)', () => {
  it('fevereiro do pgTAP: 80.000 e 10.000 → 89% e 11%', () => {
    expect(pagoPorMembro([m(A, 80000), m(B, 10000)])).toEqual([
      { membroId: A, valorCentavos: 80000, percentual: 89 },
      { membroId: B, valorCentavos: 10000, percentual: 11 },
    ]);
  });

  it('valores do mockup: 140.250 e 101.620 → 58% e 42%', () => {
    expect(pagoPorMembro([m(A, 140250), m(B, 101620)]).map((x) => x.percentual)).toEqual([58, 42]);
  });

  it('CA-16.1: A pagou 100 e B 200 → 33% e 67% (o último fecha 100)', () => {
    expect(pagoPorMembro([m(A, 100), m(B, 200)]).map((x) => x.percentual)).toEqual([33, 67]);
  });

  it('1 de 3 centavos: 33% e soma 100', () => {
    const r = pagoPorMembro([m(A, 1), m(B, 2)]);
    expect(r[0]?.percentual).toBe(33);
    expect(r.reduce((s, x) => s + x.percentual, 0)).toBe(100);
  });

  it('1 de 200 centavos (meio ponto percentual): 1% e 99%, soma 100', () => {
    expect(pagoPorMembro([m(A, 1), m(B, 199)]).map((x) => x.percentual)).toEqual([1, 99]);
  });

  it('CA-16.2: só A pagou → A 100% e B aparece com 0 e 0%', () => {
    expect(pagoPorMembro([m(A, 5000), m(B, 0)])).toEqual([
      { membroId: A, valorCentavos: 5000, percentual: 100 },
      { membroId: B, valorCentavos: 0, percentual: 0 },
    ]);
  });

  it('só o último pagou → primeiro 0% e último 100%', () => {
    expect(pagoPorMembro([m(A, 0), m(B, 5000)]).map((x) => x.percentual)).toEqual([0, 100]);
  });

  it('CA-16.3: mês sem despesa conjunta → lista vazia', () => {
    expect(pagoPorMembro([m(A, 0), m(B, 0)])).toEqual([]);
    expect(pagoPorMembro([])).toEqual([]);
  });

  it('CA-11.3: lar com 1 membro → 1 linha com 100%', () => {
    expect(pagoPorMembro([m(A, 4321)])).toEqual([{ membroId: A, valorCentavos: 4321, percentual: 100 }]);
  });

  it('preserva os demais campos e a ordem recebida', () => {
    const r = pagoPorMembro([
      { membroId: B, nome: 'Ana', valorCentavos: 3, souEu: false },
      { membroId: A, nome: 'Leo', valorCentavos: 1, souEu: true },
    ]);
    expect(r).toEqual([
      { membroId: B, nome: 'Ana', valorCentavos: 3, souEu: false, percentual: 75 },
      { membroId: A, nome: 'Leo', valorCentavos: 1, souEu: true, percentual: 25 },
    ]);
  });

  it('propriedade: com total > 0, os percentuais somam 100 e ficam entre 0 e 100', () => {
    let semente = 12345;
    const proximo = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente;
    };
    for (let i = 0; i < 5000; i++) {
      const a = proximo() % 1_000_000;
      const b = proximo() % 1_000_000;
      if (a + b === 0) continue;
      const r = pagoPorMembro([m(A, a), m(B, b)]);
      const soma = r.reduce((s, x) => s + x.percentual, 0);
      if (soma !== 100 || r.some((x) => x.percentual < 0 || x.percentual > 100)) {
        throw new Error(`a=${a} b=${b} → ${JSON.stringify(r)}`);
      }
    }
  });
});
