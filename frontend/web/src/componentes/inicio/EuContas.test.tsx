import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkConta } from '../../formatacao/linksApp';
import { EuContas } from './EuContas';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const vazio = lerResposta<ResumoMes>('resumo-mes-vazio.json');

function montar(individual: ResumoMes['individual']) {
  return render(
    <MemoryRouter>
      <EuContas individual={individual} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('EuContas', () => {
  it('uma linha por conta, na ordem da API, com o saldo e link para a T16', () => {
    montar(resumo.individual);

    const links = within(screen.getByRole('article', { name: 'Contas' })).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Nubank');
    expect(links[0]).toHaveTextContent('R$ 3.214,85');
    expect(links[0]).toHaveAttribute('href', linkConta('00000000-0000-4000-8000-000000000201'));
    expect(links[1]).toHaveTextContent('Itaú');
    expect(links[1]).toHaveTextContent('R$ 1.090,00');
    expect(links[1]).toHaveAttribute('href', linkConta('00000000-0000-4000-8000-000000000202'));
  });

  it('vazio: "Nenhuma conta cadastrada." e "Cadastrar conta"', () => {
    montar(vazio.individual);

    expect(screen.getByText('Nenhuma conta cadastrada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cadastrar conta/ })).toHaveAttribute('href', '/app/ajustes/contas/nova');
  });
});
