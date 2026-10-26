import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { CasaFixas } from './CasaFixas';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
type Conjunto = ResumoMes['conjunto'];

function montar(conjunto: Conjunto = resumo.conjunto) {
  return render(
    <MemoryRouter>
      <CasaFixas conjunto={conjunto} mes="2026-10" />
    </MemoryRouter>,
  );
}

function cartao() {
  return screen.getByRole('article', { name: /^Fixas a pagar/ });
}

function itens() {
  return within(cartao()).queryAllByRole('listitem');
}

describe('CasaFixas com pendentes', () => {
  it('3 itens na ordem da API', () => {
    montar();

    expect(itens().map((i) => i.querySelector('[class*="item-titulo"]')?.textContent)).toEqual([
      'Internet',
      'Aluguel',
      'Condomínio',
    ]);
  });

  it('Internet: "venceu 05/10", valor e selo "Atrasada" com ícone', () => {
    montar();

    const internet = itens()[0];
    expect(internet).toHaveTextContent('venceu 05/10');
    expect(internet).toHaveTextContent('R$ 119,90');
    const selo = within(internet).getByText('Atrasada');
    expect(selo.querySelector('svg') ?? selo.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('Aluguel: "vence 10/10" e "Pendente"', () => {
    montar();

    const aluguel = itens()[1];
    expect(aluguel).toHaveTextContent('vence 10/10');
    expect(within(aluguel).getByText('Pendente')).toBeInTheDocument();
  });

  it('"Marcar paga" leva à T08 pela URL, com nome acessível do item', () => {
    montar();

    const marcar = within(cartao()).getByRole('link', { name: 'Marcar como paga: Internet' });
    expect(marcar).toHaveTextContent('Marcar paga');
    expect(marcar).toHaveAttribute('href', '/app/fixas?mes=2026-10&pagar=00000000-0000-4000-8000-000000000804');
  });

  it('"Ver todas as fixas" leva às fixas do mês', () => {
    montar();

    expect(within(cartao()).getByRole('link', { name: /Ver todas as fixas/ })).toHaveAttribute(
      'href',
      '/app/fixas?mes=2026-10',
    );
  });

  it('com 5 pendentes mostra só 3', () => {
    const [a, b, c] = resumo.conjunto.fixas_pendentes;
    const cinco = [
      a,
      b,
      c,
      { ...c, ocorrencia_id: 'x4', descricao: 'Luz' },
      { ...c, ocorrencia_id: 'x5', descricao: 'Água' },
    ];
    montar({ ...resumo.conjunto, fixas_pendentes: cinco });

    expect(itens()).toHaveLength(3);
    expect(within(cartao()).queryByText('Luz')).not.toBeInTheDocument();
  });

  it('título "N de total": 5 pendentes de 7 mostra "5 de 7" com 3 itens', () => {
    const [a, b, c] = resumo.conjunto.fixas_pendentes;
    const cinco = [
      a,
      b,
      c,
      { ...c, ocorrencia_id: 'x4', descricao: 'Luz' },
      { ...c, ocorrencia_id: 'x5', descricao: 'Água' },
    ];
    montar({ ...resumo.conjunto, fixas_pendentes: cinco, fixas_total: 7 });

    expect(within(cartao()).getByText('5 de 7')).toBeInTheDocument();
    expect(itens()).toHaveLength(3);
  });

  it('título do resumo da API: "3 de 7"', () => {
    montar();

    expect(within(cartao()).getByText('3 de 7')).toBeInTheDocument();
  });
});

describe('CasaFixas sem pendentes', () => {
  it('com fixas cadastradas: "Todas as fixas do mês pagas"', () => {
    montar({ ...resumo.conjunto, fixas_pendentes: [], fixas_total: 7 });

    expect(screen.getByText('Todas as fixas do mês pagas')).toBeInTheDocument();
    expect(itens()).toHaveLength(0);
  });

  it('sem fixas: "Nenhuma despesa fixa cadastrada." e "Nova despesa fixa"', () => {
    montar({ ...resumo.conjunto, fixas_pendentes: [], fixas_total: 0 });

    expect(screen.getByText('Nenhuma despesa fixa cadastrada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nova despesa fixa/ })).toHaveAttribute('href', '/app/fixas/nova');
  });
});
