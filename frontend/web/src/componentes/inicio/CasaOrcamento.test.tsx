import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { linkOrcamento } from '../../formatacao/linksApp';
import { CasaOrcamento } from './CasaOrcamento';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const vazio = lerResposta<ResumoMes>('resumo-mes-vazio.json');
const destino = linkOrcamento({ mes: '2026-10', escopo: 'conjunto' });

function montar(conjunto: ResumoMes['conjunto']) {
  return render(
    <MemoryRouter>
      <CasaOrcamento conjunto={conjunto} mes="2026-10" />
    </MemoryRouter>,
  );
}

describe('CasaOrcamento', () => {
  it('com dado: título, barra e "Ver orçamento"', () => {
    montar(resumo.conjunto);

    expect(screen.getByRole('article', { name: /^Orçamento da casa/ })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Orçamento da casa' })).toHaveAttribute('aria-valuenow', '56');
    expect(screen.getByRole('link', { name: /Ver orçamento/ })).toHaveAttribute('href', destino);
  });

  it('vazio: "Sem orçamento em outubro." e "Definir orçamento"', () => {
    montar(vazio.conjunto);

    expect(screen.getByRole('article', { name: /^Orçamento da casa/ })).toBeInTheDocument();
    expect(screen.getByText('Sem orçamento em outubro.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Definir orçamento/ })).toHaveAttribute('href', destino);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('vazio em outro mês: usa o nome do mês recebido', () => {
    render(
      <MemoryRouter>
        <CasaOrcamento conjunto={vazio.conjunto} mes="2026-11" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sem orçamento em novembro.')).toBeInTheDocument();
    expect(screen.queryByText('Sem orçamento em outubro.')).not.toBeInTheDocument();
  });
});
