import { describe, expect, it } from 'vitest';
import { FIXAS, parcelasDaCompra, planejarMassa } from './massa-plano';

/**
 * Massa de 2 anos para a medição de CPU (PLANO etapa 9; RNF-03 "2 anos de dados (~6.000 parcelas)"; RNF-04).
 * O plano tem de ter o volume pedido, ser reprodutível e obedecer às regras de parcela (RN-14, RN-28), para que a
 * medição use dados que a API aceitaria.
 */
describe('planejarMassa', () => {
  const hoje = '2026-10-24';
  const plano = planejarMassa(hoje);
  const parcelas = plano.flatMap((l) => l.parcelas);

  it('cerca de 6 mil parcelas em 24 meses (RNF-03)', () => {
    expect(parcelas.length).toBeGreaterThanOrEqual(5_500);
    expect(parcelas.length).toBeLessThanOrEqual(6_500);
    const operacoes = plano.map((l) => l.dataOperacao).sort();
    expect(operacoes[0]! >= '2024-11-01').toBe(true);
    expect(operacoes.at(-1)! <= hoje).toBe(true);
  });

  it('é determinístico (mesma semente, mesmo plano)', () => {
    expect(planejarMassa(hoje)).toEqual(plano);
  });

  it('a soma das parcelas é o total; Crédito em 3x; o pagamento de fixa tem 1 parcela no vencimento (RN-28)', () => {
    for (const l of plano) {
      expect(l.parcelas.reduce((s, p) => s + p.valor, 0)).toBe(l.valorTotal);
      if (l.fixa !== null) {
        expect(l.parcelas).toEqual([{ numero: 1, valor: FIXAS[l.fixa]!.previsto, data: l.dataOperacao }]);
        expect(l.escopo).toBe('conjunto');
      }
    }
    expect(plano.filter((l) => l.parcelas.length === 3).length).toBe(24 * 2 * 10);
    // Pagamentos de fixa só na janela de 12 meses e nunca de vencimento futuro.
    const pagamentos = plano.filter((l) => l.fixa !== null);
    expect(pagamentos.every((l) => l.dataOperacao >= '2025-10-01' && l.dataOperacao <= hoje)).toBe(true);
    expect(pagamentos.length).toBeGreaterThan(90);
  });

  it('parcelas do Crédito pela RN-14 (casos 4 e 5 do PRD-TECNICO)', () => {
    expect(parcelasDaCompra('credito', '2026-10-15', 10, 3, 10_000)).toEqual([
      { numero: 1, valor: 3_334, data: '2026-11-10' },
      { numero: 2, valor: 3_333, data: '2026-12-10' },
      { numero: 3, valor: 3_333, data: '2027-01-10' },
    ]);
    expect(parcelasDaCompra('credito', '2027-01-31', 31, 3, 10_000).map((p) => p.data)).toEqual([
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
    expect(parcelasDaCompra('pix', '2026-10-15', null, 1, 10_000)).toEqual([
      { numero: 1, valor: 10_000, data: '2026-10-15' },
    ]);
  });
});
