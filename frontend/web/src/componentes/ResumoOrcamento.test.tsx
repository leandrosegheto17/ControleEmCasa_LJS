import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { ResumoOrcamento } from './ResumoOrcamento';

const orcamento = lerResposta<ResumoMes>('resumo-mes.json').conjunto.orcamento;
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

function preenchimento(barra: HTMLElement) {
  return (
    barra.style.getPropertyValue('--p') ||
    (barra.querySelector('[style]') as HTMLElement | null)?.style.getPropertyValue('--p')
  );
}

function montar(o: typeof orcamento | null) {
  return render(
    <MemoryRouter>
      <ResumoOrcamento
        titulo="Orçamento da casa"
        bloco="casa"
        orcamento={o}
        linkVer="/orcamento?mes=2026-10&escopo=casa"
        textoVer="Ver orçamento"
        textoVazio="Sem orçamento em outubro."
        acaoVazio={<a href="/orcamento?mes=2026-10&escopo=casa">Definir orçamento</a>}
      />
    </MemoryRouter>,
  );
}

describe('ResumoOrcamento com dado', () => {
  it('article nomeado pelo título, com o selo da situação no h3', () => {
    montar(orcamento);

    const cartao = screen.getByRole('article', { name: /^Orçamento da casa/ });
    const titulo = within(cartao).getByRole('heading', { level: 3 });
    expect(titulo).toHaveTextContent('Orçamento da casa');
    expect(within(titulo).getByText('Dentro')).toBeInTheDocument();
  });

  it('orçado × realizado e percentual em texto', () => {
    montar(orcamento);

    expect(screen.getByText('R$ 2.418,70 de R$ 4.300,00')).toBeInTheDocument();
    expect(screen.getByText('56%')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', { name: 'Orçamento da casa' });
    expect(barra).toHaveAttribute('aria-valuenow', '56');
    expect(barra.className).toMatch(classe('barra-dentro'));
  });

  it('3 destaques na ordem recebida', () => {
    montar(orcamento);

    const barras = screen.getAllByRole('progressbar').map((b) => b.getAttribute('aria-label'));
    expect(barras).toEqual(['Orçamento da casa', 'Contas da casa', 'Delivery/iFood do casal', 'Mercado']);
    expect(screen.getByText('R$ 332,50 de R$ 300,00')).toBeInTheDocument();
    expect(screen.getByText('Estourado')).toBeInTheDocument();
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });

  it('destaque acima de 100%: aria-valuenow 111 e largura em 100%', () => {
    montar(orcamento);

    const barra = screen.getByRole('progressbar', { name: 'Contas da casa' });
    expect(barra).toHaveAttribute('aria-valuenow', '111');
    expect(barra.className).toMatch(classe('barra-estourado'));
    expect(preenchimento(barra)).toBe('100%');
    expect(screen.getByText('111%')).toBeInTheDocument();
  });

  it('link "Ver orçamento" com o destino recebido', () => {
    montar(orcamento);

    expect(screen.getByRole('link', { name: 'Ver orçamento' })).toHaveAttribute(
      'href',
      '/orcamento?mes=2026-10&escopo=casa',
    );
  });
});

describe('ResumoOrcamento sem orçamento', () => {
  it('linha vazia e ação, sem barra', () => {
    montar(null);

    expect(screen.getByText('Sem orçamento em outubro.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Definir orçamento' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver orçamento' })).not.toBeInTheDocument();
  });
});
