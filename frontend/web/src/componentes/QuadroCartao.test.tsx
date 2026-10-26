import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { QuadroCartao } from './QuadroCartao';

const montar = (mes: string | undefined) =>
  render(
    <MemoryRouter>
      <QuadroCartao
        nome="Cartão XP"
        gastoMesCentavos={128460}
        comprometidoFuturoCentavos={215000}
        mes={mes}
        destinoPagamento="?pagamento=1"
      />
    </MemoryRouter>,
  );

describe('QuadroCartao', () => {
  it('mostra o nome, os totais da view, o mês e o link de pagamento', () => {
    montar('outubro');
    const quadro = screen.getByRole('heading', { level: 2, name: 'Cartão XP' }).closest('section')!;
    expect(within(quadro).getByText('Neste mês (parcelas com data em outubro)')).toBeInTheDocument();
    expect(within(quadro).getByText('R$ 1.284,60')).toBeInTheDocument();
    expect(within(quadro).getByText('R$ 2.150,00')).toBeInTheDocument();
    expect(within(quadro).getByRole('link', { name: 'Registrar pagamento do cartão' })).toHaveAttribute(
      'href',
      '/?pagamento=1',
    );
  });

  it('sem o mês do contexto mostra só "Neste mês"', () => {
    montar(undefined);
    expect(screen.getByText('Neste mês')).toBeInTheDocument();
  });
});
