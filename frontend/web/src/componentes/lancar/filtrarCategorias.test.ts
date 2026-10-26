import { describe, expect, it } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { filtrarCategorias } from './filtrarCategorias';

const categorias = lerResposta<DadosLancamento>('dados-lancamento.json').categorias_despesa;

const nomes = (lista: { nome: string }[]) => lista.map((c) => c.nome);

describe('filtrarCategorias', () => {
  it('"merc" acha "Mercado"', () => {
    expect(nomes(filtrarCategorias(categorias, 'merc'))).toEqual(['Mercado']);
  });

  it('ignora acento: "almoco" acha "Almoço/Alimentação fora"', () => {
    expect(nomes(filtrarCategorias(categorias, 'almoco'))).toEqual(['Almoço/Alimentação fora']);
  });

  it('ignora caixa: "MORADIA" acha "Moradia"', () => {
    expect(nomes(filtrarCategorias(categorias, 'MORADIA'))).toEqual(['Moradia']);
  });

  it('acha pelo meio do nome, na ordem recebida', () => {
    expect(nomes(filtrarCategorias(categorias, 'outros'))).toEqual(['Outros da casa', 'Outros']);
  });

  it('termo vazio devolve tudo', () => {
    expect(filtrarCategorias(categorias, '')).toEqual(categorias);
  });

  it.each(['(', '*', '[', '.*', '\\'])('termo "%s" não lança', (termo) => {
    expect(() => filtrarCategorias(categorias, termo)).not.toThrow();
    expect(filtrarCategorias(categorias, termo)).toEqual([]);
  });

  it('não muta a lista recebida', () => {
    const copia = structuredClone(categorias);
    filtrarCategorias(categorias, 'casa');
    expect(categorias).toEqual(copia);
  });
});
