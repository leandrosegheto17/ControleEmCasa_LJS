import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { EstadosDeLeitura } from './EstadosDeLeitura';

type Dados = { nome: string };

const CATORZE_E_TRINTA_E_DOIS_EM_SP = Date.parse('2026-10-09T17:32:00Z');

function renderizar(leitura: {
  situacao: 'carregando' | 'erro' | 'cache' | 'pronto';
  dados?: Dados;
  atualizadoEm?: number;
}) {
  const aoTentarDeNovo = vi.fn();
  render(
    <EstadosDeLeitura
      leitura={leitura as never}
      esqueleto={<div data-testid="esqueleto" />}
      aoTentarDeNovo={aoTentarDeNovo}
    >
      {(dados: Dados) => <p>Conteúdo de {dados.nome}</p>}
    </EstadosDeLeitura>,
  );
  return { aoTentarDeNovo };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EstadosDeLeitura', () => {
  it('carregando: nada antes de 300 ms, esqueleto depois', () => {
    renderizar({ situacao: 'carregando' });
    expect(screen.queryByTestId('esqueleto')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByTestId('esqueleto')).toBeInTheDocument();
    expect(screen.queryByText(/Conteúdo de/)).toBeNull();
  });

  it('erro sem dado: estado de erro com "Tentar de novo" ligado ao callback', () => {
    const { aoTentarDeNovo } = renderizar({ situacao: 'erro' });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');
    act(() => {
      screen.getByRole('button', { name: 'Tentar de novo' }).click();
    });
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Conteúdo de/)).toBeNull();
  });

  it('cache: faixa "Mostrando dados de 14:32" (São Paulo) e o conteúdo em cache', () => {
    renderizar({
      situacao: 'cache',
      dados: { nome: 'outubro' },
      atualizadoEm: CATORZE_E_TRINTA_E_DOIS_EM_SP,
    });
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando dados de 14:32');
    expect(screen.getByText('Conteúdo de outubro')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pronto: só o conteúdo, sem faixa nem erro', () => {
    renderizar({ situacao: 'pronto', dados: { nome: 'outubro' }, atualizadoEm: CATORZE_E_TRINTA_E_DOIS_EM_SP });
    expect(screen.getByText('Conteúdo de outubro')).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando dados de/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('esqueleto')).toBeNull();
  });
});
