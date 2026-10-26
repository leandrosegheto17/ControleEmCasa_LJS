import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { LancarVazio } from './LancarVazio';

const dados = lerResposta<DadosLancamento>('dados-lancamento.json');
const semFormas = lerResposta<DadosLancamento>('dados-lancamento-sem-formas.json');

function montar(com: DadosLancamento) {
  const aoFechar = vi.fn();
  render(
    <MemoryRouter>
      <LancarVazio dados={com} aoFechar={aoFechar} />
    </MemoryRouter>,
  );
  return aoFechar;
}

describe('LancarVazio', () => {
  it('sem forma: título, texto do mockup e "Cadastrar forma"', () => {
    montar(semFormas);

    expect(screen.getByRole('heading', { name: 'Cadastre uma forma de pagamento para lançar' })).toBeInTheDocument();
    expect(
      screen.getByText('Pix, Débito ou um cartão de crédito. Só você vê as suas formas de pagamento.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar forma' })).toHaveAttribute('href', '/app/ajustes/formas/nova');
  });

  it('"Cadastrar forma" fecha a folha', async () => {
    const user = userEvent.setup();
    const aoFechar = montar(semFormas);

    await user.click(screen.getByRole('link', { name: 'Cadastrar forma' }));

    expect(aoFechar).toHaveBeenCalled();
  });

  it('com formas e sem categoria ativa: "Nenhuma categoria ativa" e "Gerenciar categorias"', () => {
    montar({ ...dados, categorias_despesa: [] });

    expect(screen.getByText('Nenhuma categoria ativa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gerenciar categorias' })).toHaveAttribute(
      'href',
      '/app/ajustes/categorias',
    );
    expect(screen.queryByRole('link', { name: 'Cadastrar forma' })).not.toBeInTheDocument();
  });
});
