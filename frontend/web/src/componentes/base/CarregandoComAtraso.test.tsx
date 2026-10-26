import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { CarregandoComAtraso } from './CarregandoComAtraso';

function avancar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const esqueleto = <div data-testid="esqueleto">forma</div>;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CarregandoComAtraso', () => {
  it('não mostra nada aos 299 ms', () => {
    const { container } = render(<CarregandoComAtraso>{esqueleto}</CarregandoComAtraso>);
    avancar(299);
    expect(screen.queryByTestId('esqueleto')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('aos 300 ms mostra o esqueleto e o texto oculto "Carregando…"', () => {
    render(<CarregandoComAtraso>{esqueleto}</CarregandoComAtraso>);
    avancar(300);
    expect(screen.getByTestId('esqueleto')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
  });

  it('o esqueleto fica fora da árvore de acessibilidade', () => {
    render(<CarregandoComAtraso>{esqueleto}</CarregandoComAtraso>);
    avancar(300);
    expect(screen.getByTestId('esqueleto').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('resposta antes de 300 ms nunca mostra o esqueleto', () => {
    function Tela({ carregando }: { carregando: boolean }) {
      return carregando ? <CarregandoComAtraso>{esqueleto}</CarregandoComAtraso> : <p>Conteúdo</p>;
    }
    const { rerender } = render(<Tela carregando />);
    avancar(200);
    rerender(<Tela carregando={false} />);
    avancar(1000);
    expect(screen.queryByTestId('esqueleto')).toBeNull();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('aceita outro atraso', () => {
    render(<CarregandoComAtraso atrasoMs={1000}>{esqueleto}</CarregandoComAtraso>);
    avancar(999);
    expect(screen.queryByTestId('esqueleto')).toBeNull();
    avancar(1);
    expect(screen.getByTestId('esqueleto')).toBeInTheDocument();
  });
});
