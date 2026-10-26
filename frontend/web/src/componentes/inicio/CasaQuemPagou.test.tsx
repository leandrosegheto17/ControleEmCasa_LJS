import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { CasaQuemPagou } from './CasaQuemPagou';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

function montar() {
  return render(
    <MemoryRouter>
      <CasaQuemPagou conjunto={resumo.conjunto} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('CasaQuemPagou', () => {
  it('article "Quem pagou"', () => {
    montar();
    expect(screen.getByRole('article', { name: 'Quem pagou' })).toBeInTheDocument();
  });

  it('um item por membro na ordem da API, com valor e percentual em texto', () => {
    montar();

    const itens = within(screen.getByRole('article', { name: 'Quem pagou' })).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Leandro');
    expect(itens[0]).toHaveTextContent('R$ 1.402,50 · 58%');
    expect(itens[1]).toHaveTextContent('Ana');
    expect(itens[1]).toHaveTextContent('R$ 1.016,20 · 42%');
  });

  it('barra decorativa: aria-hidden e sem role', () => {
    const { container } = montar();

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    const barras = Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden="true"]')).filter((b) =>
      classe('barra-casa').test(b.className),
    );
    expect(barras).toHaveLength(2);
    barras.forEach((b) => expect(b).not.toHaveAttribute('role'));
  });
});
