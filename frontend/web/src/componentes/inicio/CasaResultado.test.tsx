import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { CasaResultado } from './CasaResultado';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');

function montar(conjunto: ResumoMes['conjunto']) {
  return render(
    <MemoryRouter>
      <CasaResultado conjunto={conjunto} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('CasaResultado', () => {
  it('"Resultado da casa" com o valor da API e "parcial"', () => {
    montar(resumo.conjunto);

    expect(screen.getByRole('article', { name: 'Resultado da casa' })).toBeInTheDocument();
    expect(screen.getByText('R$ 1.881,30')).toBeInTheDocument();
    expect(screen.getByText('parcial')).toBeInTheDocument();
  });

  it('fórmula do mockup só com valores formatados', () => {
    montar(resumo.conjunto);

    expect(screen.getByText('Orçamento R$ 4.300,00 − total R$ 2.418,70')).toBeInTheDocument();
  });

  it('sem orçamento: sem a fórmula', () => {
    montar({ ...resumo.conjunto, orcamento: null });

    expect(screen.queryByText(/^Orçamento R\$/)).not.toBeInTheDocument();
    expect(screen.getByText('R$ 1.881,30')).toBeInTheDocument();
  });
});
