import { describe, expect, it } from 'vitest';
import {
  LOCAL_META_MAX_CARACTERES,
  NOME_CONTA_MAX_CARACTERES,
  normalizarTextoObrigatorio,
  normalizarTextoOpcional,
  tamanhoEmCaracteres,
  validarDiaVencimento,
  validarNumParcelas,
} from './validacoes';

const invalido = { ok: false, erro: 'valor_invalido' };

// RN-18 e CA-18.2; legado: A lancar_despesa.sql:76 (nullif(btrim(descricao), '')).
describe('normalizarTextoOpcional (CA-18.2)', () => {
  it('CA-18.2: "   " é gravada como nula', () =>
    expect(normalizarTextoOpcional('   ')).toEqual({ ok: true, valor: null }));
  it('ausente vira nula', () => {
    expect(normalizarTextoOpcional(undefined)).toEqual({ ok: true, valor: null });
    expect(normalizarTextoOpcional(null)).toEqual({ ok: true, valor: null });
  });
  it('tira os espaços em volta', () =>
    expect(normalizarTextoOpcional('  Mercado  ')).toEqual({ ok: true, valor: 'Mercado' }));
  it('tab e quebra de linha também são removidos (divergência do btrim, ADR-007)', () => {
    expect(normalizarTextoOpcional('\t\n ')).toEqual({ ok: true, valor: null });
    expect(normalizarTextoOpcional('\tPizza\n')).toEqual({ ok: true, valor: 'Pizza' });
  });
  it('120 caracteres é aceito; 121 → valor_invalido', () => {
    expect(normalizarTextoOpcional('a'.repeat(120)).ok).toBe(true);
    expect(normalizarTextoOpcional('a'.repeat(121))).toEqual(invalido);
  });
  it('o teto conta caracteres depois do trim', () => {
    expect(normalizarTextoOpcional(`  ${'a'.repeat(120)}  `).ok).toBe(true);
  });
  it('o teto conta caracteres (pontos de código), não unidades UTF-16', () => {
    const emoji = '😀'.repeat(120);
    expect(tamanhoEmCaracteres(emoji)).toBe(120);
    expect(normalizarTextoOpcional(emoji).ok).toBe(true);
  });
});

describe('normalizarTextoObrigatorio (RN-18)', () => {
  it('nome válido é aceito sem os espaços em volta', () => {
    expect(normalizarTextoObrigatorio('  Nubank ', NOME_CONTA_MAX_CARACTERES)).toEqual({ ok: true, valor: 'Nubank' });
  });
  it.each([
    ['', 'vazio'],
    ['   ', 'só espaços'],
    [null, 'nulo'],
    [undefined, 'ausente'],
  ])('%j → valor_invalido (%s)', (...[texto]) => {
    expect(normalizarTextoObrigatorio(texto)).toEqual(invalido);
  });
  it('nome de conta: 80 aceito, 81 recusado', () => {
    expect(normalizarTextoObrigatorio('a'.repeat(80), NOME_CONTA_MAX_CARACTERES).ok).toBe(true);
    expect(normalizarTextoObrigatorio('a'.repeat(81), NOME_CONTA_MAX_CARACTERES)).toEqual(invalido);
  });
  it('local de meta: 60 aceito, 61 recusado (CA-09.4: vazio também)', () => {
    expect(normalizarTextoObrigatorio('a'.repeat(60), LOCAL_META_MAX_CARACTERES).ok).toBe(true);
    expect(normalizarTextoObrigatorio('a'.repeat(61), LOCAL_META_MAX_CARACTERES)).toEqual(invalido);
    expect(normalizarTextoObrigatorio(' ', LOCAL_META_MAX_CARACTERES)).toEqual(invalido);
  });
  it('padrão: textos livres até 120', () => {
    expect(normalizarTextoObrigatorio('a'.repeat(120)).ok).toBe(true);
    expect(normalizarTextoObrigatorio('a'.repeat(121))).toEqual(invalido);
  });
});

// CA-03.2, CA-14.4.
describe('validarDiaVencimento', () => {
  it.each([1, 15, 31])('%i é aceito', (d) => expect(validarDiaVencimento(d)).toEqual({ ok: true, valor: d }));
  it.each([0, 32, -1, 10.5, null, undefined, '10'])('%j → valor_invalido', (d) => {
    expect(validarDiaVencimento(d)).toEqual(invalido);
  });
});

// RN-14, RN-18: 1–24, só Crédito > 1.
describe('validarNumParcelas', () => {
  it.each([1, 2, 24])('Crédito em %ix é aceito', (n) =>
    expect(validarNumParcelas('credito', n)).toEqual({ ok: true, valor: n }),
  );
  it.each([0, 25, 1.5, null])('Crédito com %j → valor_invalido', (n) => {
    expect(validarNumParcelas('credito', n)).toEqual(invalido);
  });
  it.each(['pix', 'debito', 'receita'] as const)('%s só aceita 1', (tipo) => {
    expect(validarNumParcelas(tipo, 1).ok).toBe(true);
    expect(validarNumParcelas(tipo, 2)).toEqual(invalido);
  });
});
