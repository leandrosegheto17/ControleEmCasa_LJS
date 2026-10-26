import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkLancamentos } from '../../formatacao/linksApp';
import { ListaPorCategoria } from './ListaPorCategoria';

const itens = lerResposta<ResumoMes>('resumo-mes.json').conjunto.por_categoria;
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

function montar() {
  const linkPara = (categoria: string) => linkLancamentos({ mes: '2026-10', escopo: 'conjunto', categoria });
  return render(
    <MemoryRouter>
      <ListaPorCategoria itens={itens} linkPara={linkPara} />
    </MemoryRouter>,
  );
}

describe('ListaPorCategoria', () => {
  it('ul.lista com um item-link por categoria, na ordem recebida', () => {
    const { container } = montar();

    const lista = container.querySelector('ul') as HTMLElement;
    expect(lista.className).toMatch(classe('lista'));
    const links = within(lista).getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links.map((l) => l.querySelector('[class*="item-titulo"]')?.textContent)).toEqual([
      'Moradia',
      'Mercado',
      'Delivery/iFood do casal',
      'Contas da casa',
      'Outros da casa',
    ]);
    links.forEach((l) => expect(l.className).toMatch(classe('item-link')));
  });

  it('valor formatado em cada linha', () => {
    montar();

    expect(screen.getByRole('link', { name: /^Moradia/ })).toHaveTextContent('R$ 850,00');
    expect(screen.getByRole('link', { name: /^Mercado/ })).toHaveTextContent('R$ 768,20');
  });

  it('selo "variável" só nas categorias variáveis', () => {
    montar();

    expect(within(screen.getByRole('link', { name: /^Mercado/ })).getByText('variável')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /^Delivery/ })).getByText('variável')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /^Moradia/ })).queryByText('variável')).not.toBeInTheDocument();
    expect(screen.getAllByText('variável')).toHaveLength(2);
  });

  it('o link vem de linkLancamentos', () => {
    montar();

    expect(screen.getByRole('link', { name: /^Mercado/ })).toHaveAttribute(
      'href',
      linkLancamentos({ mes: '2026-10', escopo: 'conjunto', categoria: '00000000-0000-4000-8000-000000000401' }),
    );
  });
});
