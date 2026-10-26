import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { EuMetas } from './EuMetas';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const vazio = lerResposta<ResumoMes>('resumo-mes-vazio.json');
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

function montar(individual: ResumoMes['individual']) {
  return render(
    <MemoryRouter>
      <EuMetas individual={individual} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('EuMetas', () => {
  it('"Minhas metas": Notebook 40% com barra-eu', () => {
    montar(resumo.individual);

    const cartao = screen.getByRole('article', { name: 'Minhas metas' });
    const barra = within(cartao).getByRole('progressbar', { name: 'Notebook novo' });
    expect(barra).toHaveAttribute('aria-valuenow', '40');
    expect(barra.className).toMatch(classe('barra-eu'));
    expect(within(cartao).getByText('40%')).toBeInTheDocument();
  });

  it('Curso de inglês com "Atingida"', () => {
    montar(resumo.individual);

    expect(screen.getByText('Atingida')).toBeInTheDocument();
  });

  it('vazio: "Nenhuma meta ainda." e "Nova meta"', () => {
    montar(vazio.individual);

    expect(screen.getByText('Nenhuma meta ainda.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nova meta/ })).toHaveAttribute('href', '/app/metas/nova');
  });
});
