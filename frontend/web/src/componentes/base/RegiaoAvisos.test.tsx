import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { RegiaoAvisos } from './RegiaoAvisos';
import { useAviso } from './useAviso';

function Disparador() {
  const { mostrar } = useAviso();
  return (
    <>
      <button type="button" onClick={() => mostrar('sucesso', 'Lançamento salvo')}>
        sucesso
      </button>
      <button type="button" onClick={() => mostrar('guardado', 'Guardado no aparelho')}>
        guardado
      </button>
      <button type="button" onClick={() => mostrar('erro', 'Não foi possível salvar')}>
        erro
      </button>
    </>
  );
}

function renderizar() {
  return render(
    <RegiaoAvisos>
      <Disparador />
    </RegiaoAvisos>,
  );
}

function regiao(nivel: 'polite' | 'assertive'): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[aria-live="${nivel}"]`);
  if (!el) throw new Error(`região ${nivel} ausente`);
  return el;
}

function avancar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function focar(el: HTMLElement) {
  act(() => {
    el.focus();
    fireEvent.focus(el);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RegiaoAvisos: regiões vivas', () => {
  it('as duas regiões existem antes de qualquer aviso', () => {
    renderizar();
    expect(regiao('polite')).toHaveAttribute('role', 'status');
    expect(regiao('assertive')).toHaveAttribute('role', 'alert');
    expect(regiao('polite')).toBeEmptyDOMElement();
    expect(regiao('assertive')).toBeEmptyDOMElement();
  });

  it('sucesso entra na região polite', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'sucesso' }));
    expect(regiao('polite')).toHaveTextContent('Lançamento salvo');
    expect(regiao('assertive')).not.toHaveTextContent('Lançamento salvo');
  });

  it('guardado entra na região polite', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'guardado' }));
    expect(regiao('polite')).toHaveTextContent('Guardado no aparelho');
  });

  it('erro entra na região assertive', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'erro' }));
    expect(regiao('assertive')).toHaveTextContent('Não foi possível salvar');
    expect(regiao('polite')).not.toHaveTextContent('Não foi possível salvar');
  });
});

describe('RegiaoAvisos: tempo na tela', () => {
  it('continua visível aos 3,9 s e some depois de 4 s', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'sucesso' }));
    avancar(3900);
    expect(screen.getByText('Lançamento salvo')).toBeInTheDocument();
    avancar(100);
    avancar(1000);
    expect(screen.queryByText('Lançamento salvo')).toBeNull();
  });

  it('com foco no aviso não some aos 10 s e some 4 s depois do blur', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'sucesso' }));
    const aviso = screen.getByText('Lançamento salvo');
    focar(aviso);
    avancar(10_000);
    expect(screen.getByText('Lançamento salvo')).toBeInTheDocument();
    act(() => {
      fireEvent.blur(aviso);
    });
    avancar(3900);
    expect(screen.getByText('Lançamento salvo')).toBeInTheDocument();
    avancar(1100);
    expect(screen.queryByText('Lançamento salvo')).toBeNull();
  });

  it('com o ponteiro em cima não some', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'sucesso' }));
    const aviso = screen.getByText('Lançamento salvo');
    act(() => {
      fireEvent.pointerEnter(aviso);
      fireEvent.mouseEnter(aviso);
    });
    avancar(10_000);
    expect(screen.getByText('Lançamento salvo')).toBeInTheDocument();
  });

  it('o segundo aviso espera o primeiro sair', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'sucesso' }));
    fireEvent.click(screen.getByRole('button', { name: 'guardado' }));
    expect(screen.getByText('Lançamento salvo')).toBeInTheDocument();
    expect(screen.queryByText('Guardado no aparelho')).toBeNull();
    avancar(5000);
    expect(screen.queryByText('Lançamento salvo')).toBeNull();
    expect(screen.getByText('Guardado no aparelho')).toBeInTheDocument();
    avancar(3900);
    expect(screen.getByText('Guardado no aparelho')).toBeInTheDocument();
  });
});
