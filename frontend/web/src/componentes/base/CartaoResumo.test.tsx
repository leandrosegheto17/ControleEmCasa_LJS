import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CartaoResumo } from './CartaoResumo';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

describe('CartaoResumo', () => {
  it('estado dado: article com nome do título e o conteúdo', () => {
    render(
      <CartaoResumo titulo="Total do casal" bloco="casa" estado="dado" textoVazio="Nada lançado em outubro ainda.">
        <p>Conteúdo do cartão</p>
      </CartaoResumo>,
    );

    const cartao = screen.getByRole('article', { name: 'Total do casal' });
    expect(screen.getByRole('heading', { level: 3, name: 'Total do casal' })).toBeInTheDocument();
    expect(cartao).toContainElement(screen.getByText('Conteúdo do cartão'));
    expect(cartao.className).toMatch(classe('cartao'));
    expect(screen.queryByText('Nada lançado em outubro ainda.')).toBeNull();
  });

  it('total aplica a classe cartao-total', () => {
    render(
      <CartaoResumo titulo="Total do casal" total bloco="casa" estado="dado" textoVazio="—">
        <p>x</p>
      </CartaoResumo>,
    );

    expect(screen.getByRole('article', { name: 'Total do casal' }).className).toMatch(classe('cartao-total'));
  });

  it('título com selo continua nomeando o article', () => {
    render(
      <CartaoResumo
        titulo={
          <>
            Orçamento da casa <span>Dentro</span>
          </>
        }
        bloco="casa"
        estado="dado"
        textoVazio="Sem orçamento em outubro."
      >
        <p>x</p>
      </CartaoResumo>,
    );

    expect(screen.getByRole('article', { name: /Orçamento da casa/ })).toBeInTheDocument();
  });

  it('estado vazio: mostra a linha vazia e a ação, sem o conteúdo', () => {
    render(
      <CartaoResumo
        titulo="Despesas fixas"
        bloco="casa"
        estado="vazio"
        textoVazio="Nenhuma despesa fixa cadastrada."
        acaoVazio={<a href="/fixas/nova">Cadastrar fixa</a>}
      >
        <p>Conteúdo do cartão</p>
      </CartaoResumo>,
    );

    const cartao = screen.getByRole('article', { name: 'Despesas fixas' });
    const linha = screen.getByText('Nenhuma despesa fixa cadastrada.');
    expect(linha.className).toMatch(classe('estado-linha'));
    expect(cartao).toContainElement(linha);
    expect(screen.getByRole('link', { name: 'Cadastrar fixa' })).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo do cartão')).toBeNull();
  });

  it('estado carregando: peças de esqueleto no lugar do conteúdo', () => {
    const { container } = render(
      <CartaoResumo titulo="Total do casal" bloco="casa" estado="carregando" textoVazio="—">
        <p>Conteúdo do cartão</p>
      </CartaoResumo>,
    );

    expect(screen.queryByText('Conteúdo do cartão')).toBeNull();
    const pecas = Array.from(container.querySelectorAll('*')).filter((el) =>
      classe('esqueleto').test(el.getAttribute('class') ?? ''),
    );
    expect(pecas.length).toBeGreaterThan(0);
  });
});
