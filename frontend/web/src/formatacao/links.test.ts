import { describe, expect, it } from 'vitest';
import { linkConta, linkFixas, linkForma, linkLancamentos, linkMeta, linkOrcamento } from './links';

const MERCADO = '00000000-0000-4000-8000-000000000401';

function partes(link: string) {
  const url = new URL(link, 'http://x');
  return { caminho: url.pathname, params: Object.fromEntries(url.searchParams) };
}

describe('formatacao/links', () => {
  it('linkLancamentos da casa leva mês, escopo=casa e categoria', () => {
    expect(partes(linkLancamentos({ mes: '2026-10', escopo: 'conjunto', categoria: MERCADO }))).toEqual({
      caminho: '/lancamentos',
      params: { mes: '2026-10', escopo: 'casa', categoria: MERCADO },
    });
  });

  it('linkLancamentos individual usa escopo=eu', () => {
    expect(partes(linkLancamentos({ mes: '2026-10', escopo: 'individual', categoria: MERCADO })).params).toEqual({
      mes: '2026-10',
      escopo: 'eu',
      categoria: MERCADO,
    });
  });

  it('linkOrcamento com mês e escopo', () => {
    expect(partes(linkOrcamento({ mes: '2026-10', escopo: 'conjunto' }))).toEqual({
      caminho: '/orcamento',
      params: { mes: '2026-10', escopo: 'casa' },
    });
    expect(partes(linkOrcamento({ mes: '2026-10', escopo: 'individual' })).params.escopo).toBe('eu');
  });

  it('linkFixas só com o mês', () => {
    expect(linkFixas({ mes: '2026-10' })).toBe('/fixas?mes=2026-10');
  });

  it('linkFixas com pagar abre a T08 pela URL', () => {
    expect(linkFixas({ mes: '2026-10', pagar: '00000000-0000-4000-8000-000000000804' })).toBe(
      '/fixas?mes=2026-10&pagar=00000000-0000-4000-8000-000000000804',
    );
  });

  it('linkMeta acrescenta ?movimentar= só quando pedido', () => {
    expect(linkMeta('m1', { movimentar: 'aporte' })).toBe('/metas/m1?movimentar=aporte');
    expect(linkMeta('m1', { movimentar: 'retirada' })).toBe('/metas/m1?movimentar=retirada');
  });

  it('linkMeta, linkConta e linkForma apontam para o detalhe', () => {
    expect(linkMeta('00000000-0000-4000-8000-000000000901')).toBe('/metas/00000000-0000-4000-8000-000000000901');
    expect(linkConta('00000000-0000-4000-8000-000000000201')).toBe(
      '/ajustes/contas/00000000-0000-4000-8000-000000000201',
    );
    expect(linkForma('00000000-0000-4000-8000-000000000303')).toBe(
      '/ajustes/formas/00000000-0000-4000-8000-000000000303',
    );
  });
});
