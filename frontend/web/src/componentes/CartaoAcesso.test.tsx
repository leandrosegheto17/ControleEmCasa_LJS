import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartaoAcesso } from './CartaoAcesso';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

describe('CartaoAcesso', () => {
  it('main > form nomeado pelo h1, com a logo Controle em Casa', () => {
    render(
      <CartaoAcesso titulo="Entrar" aoEnviar={vi.fn()}>
        <p>campos</p>
      </CartaoAcesso>,
    );

    const main = screen.getByRole('main');
    expect(main.className).toMatch(classe('tela-entrar'));
    const form = screen.getByRole('form', { name: 'Entrar' });
    expect(main).toContainElement(form);
    expect(form.className).toMatch(classe('cartao-entrar'));
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(form).toHaveTextContent('Controle em Casa');
    expect(form.querySelector('use[href="#i-casa"]')).not.toBeNull();
    expect(form).toContainElement(screen.getByText('campos'));
  });

  it('aria-busy só quando ocupado', () => {
    const { rerender } = render(
      <CartaoAcesso titulo="Entrar" aoEnviar={vi.fn()}>
        <p>campos</p>
      </CartaoAcesso>,
    );
    expect(screen.getByRole('form')).not.toHaveAttribute('aria-busy', 'true');

    rerender(
      <CartaoAcesso titulo="Entrar" aoEnviar={vi.fn()} ocupado>
        <p>campos</p>
      </CartaoAcesso>,
    );
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
  });

  it('o envio chama aoEnviar sem recarregar a página', () => {
    const aoEnviar = vi.fn();
    render(
      <CartaoAcesso titulo="Nova senha" aoEnviar={aoEnviar}>
        <button type="submit">Salvar senha</button>
      </CartaoAcesso>,
    );

    const evento = new Event('submit', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('form', { name: 'Nova senha' }), evento);
    expect(aoEnviar).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });
});
