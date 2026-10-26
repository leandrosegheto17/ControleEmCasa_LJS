import { describe, expect, it } from 'vitest';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { textoAvisoLancamento } from './textoAvisoLancamento';

type Resposta = Parameters<typeof textoAvisoLancamento>[0];

const credito = lerResposta<Resposta>('lancar-despesa-credito.json');

describe('textoAvisoLancamento', () => {
  it('uma parcela: "Lançado: R$ 45,90 · Mercado · Casa"', () => {
    const pix = {
      ...credito,
      valor_total_centavos: 4590,
      num_parcelas: 1,
      primeira_parcela_data: '2026-10-09',
    } as Resposta;

    expect(textoAvisoLancamento(pix)).toBe('Lançado: R$ 45,90 · Mercado · Casa');
  });

  it('uma parcela individual usa o selo "Eu"', () => {
    const individual = {
      ...credito,
      escopo: 'individual',
      categoria: 'Transporte',
      valor_total_centavos: 1230,
      num_parcelas: 1,
      primeira_parcela_data: '2026-10-09',
    } as Resposta;

    expect(textoAvisoLancamento(individual)).toBe('Lançado: R$ 12,30 · Transporte · Eu');
  });

  it('crédito parcelado: parcelas, categoria, escopo e a 1ª parcela vinda da resposta', () => {
    expect(textoAvisoLancamento(credito)).toBe('Lançado em 3x · Mercado · Casa · 1ª parcela em 10/11');
  });

  it('a data da 1ª parcela vem de primeira_parcela_data, sem cálculo', () => {
    const outra = { ...credito, primeira_parcela_data: '2027-01-05' } as Resposta;

    expect(textoAvisoLancamento(outra)).toBe('Lançado em 3x · Mercado · Casa · 1ª parcela em 05/01');
  });
});
