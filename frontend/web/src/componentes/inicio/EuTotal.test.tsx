import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { EuTotal } from './EuTotal';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const vazio = lerResposta<ResumoMes>('resumo-mes-vazio.json');

function montar(individual: ResumoMes['individual'], mesVazio = false) {
  return render(
    <MemoryRouter>
      <EuTotal individual={individual} mes="2026-10" mesVazio={mesVazio} />
    </MemoryRouter>,
  );
}

function valorDaLinha(rotulo: string) {
  return screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('EuTotal', () => {
  it('"Meu total" em destaque com "parcial"', () => {
    montar(resumo.individual);

    expect(screen.getByRole('article', { name: 'Meu total' })).toBeInTheDocument();
    expect(screen.getByText('R$ 2.248,80')).toBeInTheDocument();
    expect(screen.getByText('parcial')).toBeInTheDocument();
  });

  it('as duas parcelas sempre visíveis e as variáveis', () => {
    montar(resumo.individual);

    expect(valorDaLinha('Minha parte na casa')).toBe('R$ 1.402,50');
    expect(valorDaLinha('Meu individual')).toBe('R$ 846,30');
    expect(valorDaLinha('Variáveis')).toBe('R$ 1.503,70');
  });

  it('sem "parcial" com o mês fechado', () => {
    montar({ ...resumo.individual, resultado: { ...resumo.individual.resultado, parcial: false } });
    expect(screen.queryByText('parcial')).not.toBeInTheDocument();
  });

  it('mês vazio: as duas parcelas em R$ 0,00 e sem "Variáveis"', () => {
    montar(vazio.individual, true);

    expect(valorDaLinha('Minha parte na casa')).toBe('R$ 0,00');
    expect(valorDaLinha('Meu individual')).toBe('R$ 0,00');
    expect(screen.queryByText('Variáveis', { selector: 'dt' })).not.toBeInTheDocument();
  });
});
