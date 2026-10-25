import { describe, expect, it } from 'vitest';
import { movimentoCabeNoLocal, normalizarMeta, normalizarMovimentoMeta } from './metas';
import { normalizarValorOrcamento } from './orcamento';

// Critérios: RN-08 (nome, alvo > 0, prazo no dia 1), RN-09 (local 1–60, tipo, retirada limitada ao local; CA-09.1,
// CA-09.4), RN-16 "Definir" (valor ausente remove) e RN-18 (teto de 10^11).
describe('normalizarMeta (RN-08)', () => {
  it('apara o nome e leva o prazo ao dia 1 do mês', () => {
    expect(normalizarMeta({ nome: '  Carro ', alvoCentavos: 100_000, prazo: '2027-03-17' })).toEqual({
      ok: true,
      valor: { nome: 'Carro', alvoCentavos: 100_000, prazo: '2027-03-01' },
    });
  });
  it('prazo ausente vira nulo', () => {
    const r = normalizarMeta({ nome: 'Viagem', alvoCentavos: 1, prazo: undefined });
    expect(r).toEqual({ ok: true, valor: { nome: 'Viagem', alvoCentavos: 1, prazo: null } });
  });
  it.each([
    ['nome vazio', { nome: '   ', alvoCentavos: 10, prazo: null }],
    ['nome nulo', { nome: null, alvoCentavos: 10, prazo: null }],
    ['nome com 121 caracteres', { nome: 'a'.repeat(121), alvoCentavos: 10, prazo: null }],
    ['alvo zero', { nome: 'x', alvoCentavos: 0, prazo: null }],
    ['alvo negativo', { nome: 'x', alvoCentavos: -5, prazo: null }],
    ['alvo fracionado', { nome: 'x', alvoCentavos: 1.5, prazo: null }],
    ['alvo acima de 10^11', { nome: 'x', alvoCentavos: 100_000_000_001, prazo: null }],
    ['prazo inexistente', { nome: 'x', alvoCentavos: 10, prazo: '2026-02-30' }],
  ])('recusa com valor_invalido: %s', (_n, entrada) => {
    expect(normalizarMeta(entrada)).toEqual({ ok: false, erro: 'valor_invalido' });
  });
  it('aceita o teto de 10^11', () => {
    expect(normalizarMeta({ nome: 'x', alvoCentavos: 100_000_000_000, prazo: null }).ok).toBe(true);
  });
});

describe('normalizarMovimentoMeta (RN-09, CA-09.4)', () => {
  it('apara o local', () => {
    expect(normalizarMovimentoMeta({ tipo: 'aporte', valorCentavos: 500, local: '  Nubank ' })).toEqual({
      ok: true,
      valor: { tipo: 'aporte', valorCentavos: 500, local: 'Nubank' },
    });
  });
  it.each([
    ['local vazio', { tipo: 'aporte', valorCentavos: 1, local: '  ' }],
    ['local com 61 caracteres', { tipo: 'aporte', valorCentavos: 1, local: 'a'.repeat(61) }],
    ['tipo desconhecido', { tipo: 'transferencia', valorCentavos: 1, local: 'x' }],
    ['valor zero', { tipo: 'retirada', valorCentavos: 0, local: 'x' }],
    ['valor acima do teto', { tipo: 'aporte', valorCentavos: 100_000_000_001, local: 'x' }],
  ])('recusa com valor_invalido: %s', (_n, entrada) => {
    expect(normalizarMovimentoMeta(entrada)).toEqual({ ok: false, erro: 'valor_invalido' });
  });
  it('local com 60 caracteres passa', () => {
    expect(normalizarMovimentoMeta({ tipo: 'aporte', valorCentavos: 1, local: 'a'.repeat(60) }).ok).toBe(true);
  });
});

describe('movimentoCabeNoLocal (RN-09, CA-09.1)', () => {
  it('retirada igual ao guardado no local cabe; um centavo a mais não', () => {
    expect(movimentoCabeNoLocal({ tipo: 'retirada', valorCentavos: 1000, guardadoNoLocalCentavos: 1000 })).toBe(true);
    expect(movimentoCabeNoLocal({ tipo: 'retirada', valorCentavos: 1001, guardadoNoLocalCentavos: 1000 })).toBe(false);
  });
  it('local sem saldo não aceita retirada', () => {
    expect(movimentoCabeNoLocal({ tipo: 'retirada', valorCentavos: 1, guardadoNoLocalCentavos: 0 })).toBe(false);
  });
  it('aporte nunca é limitado', () => {
    expect(movimentoCabeNoLocal({ tipo: 'aporte', valorCentavos: 9_999, guardadoNoLocalCentavos: 0 })).toBe(true);
  });
});

describe('normalizarValorOrcamento (RN-16 Definir, RN-18)', () => {
  it('nulo ou ausente remove', () => {
    expect(normalizarValorOrcamento(null)).toEqual({ ok: true, valor: { remover: true } });
    expect(normalizarValorOrcamento(undefined)).toEqual({ ok: true, valor: { remover: true } });
  });
  it('valor positivo até 10^11 grava', () => {
    expect(normalizarValorOrcamento(1)).toEqual({ ok: true, valor: { remover: false, valorCentavos: 1 } });
    expect(normalizarValorOrcamento(100_000_000_000).ok).toBe(true);
  });
  it.each([0, -1, 1.5, 100_000_000_001])('recusa %s com valor_invalido', (v) => {
    expect(normalizarValorOrcamento(v)).toEqual({ ok: false, erro: 'valor_invalido' });
  });
});
