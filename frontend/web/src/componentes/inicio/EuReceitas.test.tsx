import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { EuReceitas } from './EuReceitas';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

function montar(individual: ResumoMes['individual']) {
  return render(
    <MemoryRouter>
      <EuReceitas individual={individual} mes="2026-10" />
    </MemoryRouter>,
  );
}

function ddDe(rotulo: string) {
  return screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling as HTMLElement;
}

describe('EuReceitas', () => {
  it('receitas com a classe de receita', () => {
    montar(resumo.individual);

    expect(ddDe('Receitas')).toHaveTextContent('R$ 7.500,00');
    expect(ddDe('Receitas').className).toMatch(classe('valor-receita'));
  });

  it('meu total com o sinal só na apresentação, resultado e guardado', () => {
    montar(resumo.individual);

    expect(ddDe('Meu total')).toHaveTextContent('− R$ 2.248,80');
    expect(ddDe('Resultado')).toHaveTextContent('R$ 5.251,20');
    expect(ddDe('Guardado no mês')).toHaveTextContent('R$ 500,00');
  });

  it('guardado no mês 0 aparece como R$ 0,00', () => {
    montar({ ...resumo.individual, guardado_no_mes_centavos: 0 });
    expect(ddDe('Guardado no mês')).toHaveTextContent('R$ 0,00');
  });

  it('"parcial" no h3 só com parcial: true', () => {
    const { unmount } = montar(resumo.individual);
    const titulo = within(screen.getByRole('article', { name: /^Receitas e resultado/ })).getByRole('heading', {
      level: 3,
    });
    expect(within(titulo).getByText('parcial')).toBeInTheDocument();
    unmount();

    montar({ ...resumo.individual, resultado: { ...resumo.individual.resultado, parcial: false } });
    expect(screen.queryByText('parcial')).not.toBeInTheDocument();
  });
});
