import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkForma } from '../../formatacao/linksApp';
import { EuCartoes } from './EuCartoes';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');

function montar() {
  return render(
    <MemoryRouter>
      <EuCartoes individual={resumo.individual} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('EuCartoes', () => {
  it('cartão de crédito com vencimento, gasto do mês e comprometido futuro', () => {
    montar();

    const link = within(screen.getByRole('article', { name: 'Cartões' })).getByRole('link');
    expect(link).toHaveTextContent('Cartão de crédito XP');
    expect(within(link).getByText('vence dia 10')).toBeInTheDocument();
    expect(within(link).getByText('Neste mês R$ 1.284,60')).toBeInTheDocument();
    expect(within(link).getByText('Próximos meses R$ 2.150,00')).toBeInTheDocument();
  });

  it('link para a T18 com o forma_id', () => {
    montar();

    expect(screen.getByRole('link', { name: /Cartão de crédito XP/ })).toHaveAttribute(
      'href',
      linkForma('00000000-0000-4000-8000-000000000303'),
    );
  });
});
