import { describe, it, expect } from 'vitest';
import { montarTitulo } from './titulo';

describe('montarTitulo', () => {
  it('com mês: "Nome · Mês de Ano · Controle em Casa"', () => {
    expect(montarTitulo('Início', '2026-10')).toBe('Início · Outubro de 2026 · Controle em Casa');
  });

  it('aceita o mês no formato AAAA-MM-01', () => {
    expect(montarTitulo('Orçamento', '2026-01-01')).toBe('Orçamento · Janeiro de 2026 · Controle em Casa');
  });

  it('sem mês: "Nome · Controle em Casa"', () => {
    expect(montarTitulo('Ajustes')).toBe('Ajustes · Controle em Casa');
  });

  it('mês vazio é tratado como ausente', () => {
    expect(montarTitulo('Entrar', undefined)).toBe('Entrar · Controle em Casa');
  });
});
