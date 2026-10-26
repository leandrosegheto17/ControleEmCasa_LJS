import { describe, expect, it } from 'vitest';
import { escreverFiltrosNaUrl, lerFiltrosDaUrl, paraFiltrosApi, textoVazioFiltrado } from './filtrosLancamentos';

const DEBITO_ITAU = '00000000-0000-4000-8000-000000000302';
const MERCADO = '00000000-0000-4000-8000-000000000401';

describe('lerFiltrosDaUrl', () => {
  it('lê escopo e forma válidos', () => {
    const params = new URLSearchParams(`mes=2026-10&escopo=casa&forma=${DEBITO_ITAU}`);
    expect(lerFiltrosDaUrl(params)).toEqual({ escopo: 'casa', forma: DEBITO_ITAU });
  });

  it('lê todos os filtros', () => {
    const params = new URLSearchParams(`escopo=eu&categoria=${MERCADO}&forma=${DEBITO_ITAU}&variavel=1`);
    expect(lerFiltrosDaUrl(params)).toEqual({
      escopo: 'eu',
      categoria: MERCADO,
      forma: DEBITO_ITAU,
      variavel: true,
    });
  });

  it('sem parâmetros: nenhum filtro', () => {
    expect(lerFiltrosDaUrl(new URLSearchParams('mes=2026-10'))).toEqual({});
  });

  it('ignora valores fora do formato', () => {
    const params = new URLSearchParams('escopo=xyz&forma=abc&categoria=1;drop&variavel=talvez');
    expect(lerFiltrosDaUrl(params)).toEqual({});
  });
});

describe('escreverFiltrosNaUrl', () => {
  it('preserva o mês e grava os filtros', () => {
    const entrada = new URLSearchParams('mes=2026-10');
    const saida = escreverFiltrosNaUrl(entrada, { escopo: 'casa', forma: DEBITO_ITAU });
    expect(saida.get('mes')).toBe('2026-10');
    expect(saida.get('escopo')).toBe('casa');
    expect(saida.get('forma')).toBe(DEBITO_ITAU);
  });

  it('ida e volta: escrever e ler devolve o mesmo objeto', () => {
    const filtros = { escopo: 'eu' as const, categoria: MERCADO, variavel: true as const };
    const params = escreverFiltrosNaUrl(new URLSearchParams('mes=2026-10'), filtros);
    expect(lerFiltrosDaUrl(params)).toEqual(filtros);
  });

  it('filtro ausente remove o parâmetro e não muta a entrada', () => {
    const entrada = new URLSearchParams(`mes=2026-10&escopo=casa&forma=${DEBITO_ITAU}`);
    const saida = escreverFiltrosNaUrl(entrada, {});
    expect(saida.toString()).toBe('mes=2026-10');
    expect(entrada.get('escopo')).toBe('casa');
    expect(saida).not.toBe(entrada);
  });
});

describe('paraFiltrosApi', () => {
  it('"eu" → individual e "casa" → conjunto', () => {
    expect(paraFiltrosApi({ escopo: 'eu' })).toEqual({ escopo: 'individual' });
    expect(paraFiltrosApi({ escopo: 'casa' })).toEqual({ escopo: 'conjunto' });
  });

  it('categoria, forma e variável viram categoriaId, formaId e variavel', () => {
    expect(paraFiltrosApi({ categoria: MERCADO, forma: DEBITO_ITAU, variavel: true })).toEqual({
      categoriaId: MERCADO,
      formaId: DEBITO_ITAU,
      variavel: true,
    });
  });

  it('sem filtros: objeto vazio', () => {
    expect(paraFiltrosApi({})).toEqual({});
  });
});

describe('textoVazioFiltrado', () => {
  const GENERICA = 'Nenhum lançamento em outubro com esses filtros.';

  it('usa a frase própria só para casa + forma', () => {
    expect(textoVazioFiltrado({ escopo: 'casa', forma: DEBITO_ITAU }, 'outubro', 'Débito Itaú')).toBe(
      'Em outubro, você não pagou despesas da casa com o Débito Itaú.',
    );
  });

  it.each([
    ['categoria', { categoria: MERCADO }],
    ['variável', { variavel: true as const }],
    ['Eu', { escopo: 'eu' as const }],
    ['casa com categoria e forma', { escopo: 'casa' as const, forma: DEBITO_ITAU, categoria: MERCADO }],
  ])('usa a frase genérica com o filtro %s', (_nome, filtros) => {
    expect(textoVazioFiltrado(filtros, 'outubro', 'Débito Itaú')).toBe(GENERICA);
  });

  it('usa a frase genérica em casa sem forma e quando o nome da forma é desconhecido', () => {
    expect(textoVazioFiltrado({ escopo: 'casa' }, 'outubro', undefined)).toBe(GENERICA);
    expect(textoVazioFiltrado({ escopo: 'casa', forma: DEBITO_ITAU }, 'outubro', undefined)).toBe(GENERICA);
  });
});
