import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkMeta } from '../../formatacao/linksApp';
import { CasaMetas } from './CasaMetas';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const vazio = lerResposta<ResumoMes>('resumo-mes-vazio.json');

function montar(conjunto: ResumoMes['conjunto']) {
  return render(
    <MemoryRouter>
      <CasaMetas conjunto={conjunto} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('CasaMetas', () => {
  it('com dado: "Metas da casa" com 2 metas', () => {
    montar(resumo.conjunto);

    const cartao = screen.getByRole('article', { name: 'Metas da casa' });
    const links = within(cartao).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', linkMeta('00000000-0000-4000-8000-000000000901'));
    expect(within(cartao).getByRole('progressbar', { name: 'Viagem Nordeste' })).toBeInTheDocument();
  });

  it('vazio: "Nenhuma meta da casa." e "Nova meta"', () => {
    montar(vazio.conjunto);

    expect(screen.getByText('Nenhuma meta da casa.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nova meta/ })).toHaveAttribute('href', '/app/metas/nova');
  });
});
