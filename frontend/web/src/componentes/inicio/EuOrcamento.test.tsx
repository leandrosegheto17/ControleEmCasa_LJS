import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkOrcamento } from '../../formatacao/linksApp';
import { EuOrcamento } from './EuOrcamento';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');

function montar(individual: ResumoMes['individual']) {
  return render(
    <MemoryRouter>
      <EuOrcamento individual={individual} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('EuOrcamento', () => {
  it('"Meu orçamento" com orçado × realizado, % e selo', () => {
    montar(resumo.individual);

    expect(screen.getByRole('article', { name: /^Meu orçamento/ })).toBeInTheDocument();
    expect(screen.getByText('R$ 846,30 de R$ 1.200,00')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getAllByText('Dentro').length).toBeGreaterThan(0);
  });

  it('3 destaques na ordem da API', () => {
    montar(resumo.individual);

    expect(screen.getAllByRole('progressbar').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Meu orçamento',
      'Almoço/Alimentação fora',
      'Delivery pessoal',
      'Transporte',
    ]);
  });

  it('"Ver meu orçamento" com escopo eu', () => {
    montar(resumo.individual);

    const link = screen.getByRole('link', { name: /Ver meu orçamento/ });
    expect(link).toHaveAttribute('href', linkOrcamento({ mes: '2026-10', escopo: 'individual' }));
    expect(link.getAttribute('href')).toContain('escopo=eu');
  });

  it('sem orçamento: cartão continua, sem barra', () => {
    montar({ ...resumo.individual, orcamento: null });

    expect(screen.getByRole('article', { name: /^Meu orçamento/ })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
