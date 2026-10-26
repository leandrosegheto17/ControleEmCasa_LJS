import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkLancamentos } from '../../formatacao/linksApp';
import { CasaPorCategoria } from './CasaPorCategoria';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');

function montar() {
  return render(
    <MemoryRouter>
      <CasaPorCategoria conjunto={resumo.conjunto} mes="2026-10" />
    </MemoryRouter>,
  );
}

function cartao() {
  return screen.getByRole('article', { name: 'Por categoria' });
}

describe('CasaPorCategoria', () => {
  it('5 links na ordem da API', () => {
    montar();

    const links = within(cartao()).getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Moradia'),
      expect.stringContaining('Mercado'),
      expect.stringContaining('Delivery/iFood do casal'),
      expect.stringContaining('Contas da casa'),
      expect.stringContaining('Outros da casa'),
    ]);
  });

  it('selo "variável" só em Mercado e Delivery', () => {
    montar();

    const comSelo = within(cartao())
      .getAllByRole('link')
      .filter((l) => within(l).queryByText('variável'))
      .map((l) => l.querySelector('[class*="item-titulo"]')?.textContent);
    expect(comSelo).toEqual(['Mercado', 'Delivery/iFood do casal']);
  });

  it('link de Mercado leva à T04 filtrada pela categoria da casa', () => {
    montar();

    expect(within(cartao()).getByRole('link', { name: /^Mercado/ })).toHaveAttribute(
      'href',
      linkLancamentos({ mes: '2026-10', escopo: 'conjunto', categoria: '00000000-0000-4000-8000-000000000401' }),
    );
  });

  it('valores formatados', () => {
    montar();
    expect(within(cartao()).getByRole('link', { name: /^Mercado/ })).toHaveTextContent('R$ 768,20');
  });
});
