import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Faixa } from './Faixa';

function faixaDe(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild as HTMLElement | null;
  if (!el) throw new Error('faixa não renderizada');
  return el;
}

function iconeDe(el: HTMLElement): string | null | undefined {
  return el.querySelector('use')?.getAttribute('href');
}

describe('Faixa', () => {
  it('offline: role=status, classe de aviso e ícone envio', () => {
    const { container } = render(
      <Faixa variante="offline">Sem conexão. Os lançamentos de despesa ficam guardados no aparelho.</Faixa>,
    );
    const faixa = faixaDe(container);
    expect(faixa).toHaveAttribute('role', 'status');
    expect(faixa.className).toMatch(/faixa-aviso/);
    expect(iconeDe(faixa)).toBe('#i-envio');
    expect(faixa).toHaveTextContent('Sem conexão. Os lançamentos de despesa ficam guardados no aparelho.');
  });

  it('pendentes: role=status, classe de aviso, ícone envio, texto e ação de quem chama', () => {
    const { container } = render(
      <Faixa variante="pendentes" acoes={<a href="/envios">Ver</a>}>
        1 lançamento aguardando envio. Ele fica guardado no aparelho.
      </Faixa>,
    );
    const faixa = faixaDe(container);
    expect(faixa).toHaveAttribute('role', 'status');
    expect(faixa.className).toMatch(/faixa-aviso/);
    expect(iconeDe(faixa)).toBe('#i-envio');
    expect(faixa).toHaveTextContent('1 lançamento aguardando envio. Ele fica guardado no aparelho.');
    expect(screen.getByRole('link', { name: 'Ver' })).toBeInTheDocument();
  });

  it('instalar: faixa neutra com ícone adicionar e as ações de quem chama', () => {
    const { container } = render(
      <Faixa
        variante="instalar"
        acoes={
          <>
            <button type="button">Instalar</button>
            <button type="button" aria-label="Dispensar instalação">
              x
            </button>
          </>
        }
      >
        Instale o Controle em Casa para lançar mais rápido.
      </Faixa>,
    );
    const faixa = faixaDe(container);
    // o papel da faixa de instalar está em aberto no plano (status pelo aceite, region pelo mockup)
    expect(['status', 'region']).toContain(faixa.getAttribute('role'));
    expect(faixa.className).not.toMatch(/faixa-aviso|faixa-erro/);
    expect(iconeDe(faixa)).toBe('#i-adicionar');
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispensar instalação' })).toBeInTheDocument();
  });

  it('cache: role=status e texto "Mostrando dados de {hora}"', () => {
    const { container } = render(<Faixa variante="cache" hora="14:32" />);
    const faixa = faixaDe(container);
    expect(faixa).toHaveAttribute('role', 'status');
    expect(faixa).toHaveTextContent('Mostrando dados de 14:32');
    expect(iconeDe(faixa)).toBeTruthy();
  });

  it('o ícone é decorativo', () => {
    const { container } = render(<Faixa variante="offline">Sem conexão.</Faixa>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('o texto fica no span texto-faixa', () => {
    const { container } = render(<Faixa variante="offline">Sem conexão.</Faixa>);
    const texto = screen.getByText('Sem conexão.');
    expect(texto.className).toMatch(/texto-faixa/);
    expect(faixaDe(container).contains(texto)).toBe(true);
  });

  it('não usa atributo style inline', () => {
    const { container } = render(
      <Faixa variante="instalar" acoes={<button type="button">Instalar</button>}>
        Instale o Controle em Casa para lançar mais rápido.
      </Faixa>,
    );
    expect(container.querySelector('[style]')).toBeNull();
  });
});
