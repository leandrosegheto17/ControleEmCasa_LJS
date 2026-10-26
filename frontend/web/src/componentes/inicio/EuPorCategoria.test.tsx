import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkLancamentos } from '../../formatacao/linksApp';
import { EuPorCategoria } from './EuPorCategoria';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');

function montar(individual: ResumoMes['individual'] = resumo.individual) {
  return render(
    <MemoryRouter>
      <EuPorCategoria individual={individual} mes="2026-10" />
    </MemoryRouter>,
  );
}

function cartao() {
  return screen.getByRole('article', { name: 'Por categoria' });
}

describe('EuPorCategoria', () => {
  it('4 + 4 links, com "Minha parte na casa" entre as listas', () => {
    montar();

    const listas = within(cartao()).getAllByRole('list');
    expect(listas).toHaveLength(2);
    expect(within(listas[0]).getAllByRole('link')).toHaveLength(4);
    expect(within(listas[1]).getAllByRole('link')).toHaveLength(4);
    const sub = within(cartao()).getByText('Minha parte na casa');
    expect(listas[0].compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sub.compareDocumentPosition(listas[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ordem da API nas duas listas', () => {
    montar();

    const [minhas, daCasa] = within(cartao()).getAllByRole('list');
    const titulos = (l: HTMLElement) =>
      within(l)
        .getAllByRole('link')
        .map((a) => a.querySelector('[class*="item-titulo"]')?.textContent);
    expect(titulos(minhas)).toEqual(['Almoço/Alimentação fora', 'Transporte', 'Lazer pessoal', 'Delivery pessoal']);
    expect(titulos(daCasa)).toEqual(['Moradia', 'Mercado', 'Delivery/iFood do casal', 'Contas da casa']);
  });

  it('selo "variável" conforme variavel', () => {
    montar();

    const [, daCasa] = within(cartao()).getAllByRole('list');
    expect(
      within(within(daCasa).getByRole('link', { name: /^Moradia/ })).queryByText('variável'),
    ).not.toBeInTheDocument();
    expect(within(within(daCasa).getByRole('link', { name: /^Mercado/ })).getByText('variável')).toBeInTheDocument();
    expect(within(cartao()).getAllByText('variável')).toHaveLength(6);
  });

  it('links por linkLancamentos: Moradia com escopo da casa, Transporte individual', () => {
    montar();

    const [minhas, daCasa] = within(cartao()).getAllByRole('list');
    expect(within(daCasa).getByRole('link', { name: /^Moradia/ })).toHaveAttribute(
      'href',
      linkLancamentos({ mes: '2026-10', escopo: 'conjunto', categoria: '00000000-0000-4000-8000-000000000403' }),
    );
    expect(within(minhas).getByRole('link', { name: /^Transporte/ })).toHaveAttribute(
      'href',
      linkLancamentos({ mes: '2026-10', escopo: 'individual', categoria: '00000000-0000-4000-8000-000000000413' }),
    );
  });

  it('só a lista própria: sem "Minha parte na casa" nem segunda lista', () => {
    montar({ ...resumo.individual, minha_parte_por_categoria: [] });

    expect(within(cartao()).getAllByRole('list')).toHaveLength(1);
    expect(within(cartao()).queryByText('Minha parte na casa')).not.toBeInTheDocument();
    expect(within(cartao()).getAllByRole('link')).toHaveLength(4);
  });

  it('só a parte na casa: sem primeira lista, com o subtítulo', () => {
    montar({ ...resumo.individual, por_categoria: [] });

    const listas = within(cartao()).getAllByRole('list');
    expect(listas).toHaveLength(1);
    expect(within(cartao()).getByText('Minha parte na casa')).toBeInTheDocument();
    expect(within(listas[0]).getAllByRole('link')).toHaveLength(4);
  });

  it('as duas vazias: texto do vazio e nenhuma lista', () => {
    montar({ ...resumo.individual, por_categoria: [], minha_parte_por_categoria: [] });

    expect(within(cartao()).getByText('Nenhuma despesa sua no mês.')).toBeInTheDocument();
    expect(within(cartao()).queryByRole('list')).not.toBeInTheDocument();
    expect(within(cartao()).queryByText('Minha parte na casa')).not.toBeInTheDocument();
  });
});
