import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstadoErro } from './EstadoErro';

describe('EstadoErro', () => {
  it('mostra os textos padrão do mockup com role=alert', () => {
    render(<EstadoErro aoTentarDeNovo={vi.fn()} />);
    const alerta = screen.getByRole('alert');
    expect(within(alerta).getByRole('heading', { level: 2, name: 'Não foi possível carregar' })).toBeInTheDocument();
    expect(within(alerta).getByText('Verifique a conexão e tente de novo.')).toBeInTheDocument();
  });

  it('o ícone de offline é decorativo', () => {
    render(<EstadoErro aoTentarDeNovo={vi.fn()} />);
    const alerta = screen.getByRole('alert');
    const hrefs = Array.from(alerta.querySelectorAll('use')).map((u) => u.getAttribute('href'));
    expect(hrefs).toContain('#i-offline');
    alerta.querySelectorAll('svg').forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
  });

  it('"Tentar de novo" é um botão secundário com o ícone recarregar', () => {
    render(<EstadoErro aoTentarDeNovo={vi.fn()} />);
    const botao = screen.getByRole('button', { name: 'Tentar de novo' });
    expect(botao.className).toMatch(/secundario/);
    expect(botao.querySelector('use')?.getAttribute('href')).toBe('#i-recarregar');
  });

  it('clique em "Tentar de novo" chama o callback', async () => {
    const usuario = userEvent.setup();
    const aoTentarDeNovo = vi.fn();
    render(<EstadoErro aoTentarDeNovo={aoTentarDeNovo} />);
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1);
  });

  it('aceita título e texto sobrescritos', () => {
    render(
      <EstadoErro
        titulo="Servidor indisponível"
        texto="Seus lançamentos de despesa ficam guardados no aparelho."
        aoTentarDeNovo={vi.fn()}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(within(alerta).getByRole('heading', { level: 2, name: 'Servidor indisponível' })).toBeInTheDocument();
    expect(within(alerta).getByText('Seus lançamentos de despesa ficam guardados no aparelho.')).toBeInTheDocument();
    expect(within(alerta).queryByText('Não foi possível carregar')).toBeNull();
  });
});
