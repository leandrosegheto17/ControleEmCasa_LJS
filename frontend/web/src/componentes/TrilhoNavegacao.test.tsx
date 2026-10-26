import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TrilhoNavegacao } from './TrilhoNavegacao';

function renderizar(rota: string, props: { aoLancar?: () => void; mes?: string } = {}) {
  const aoLancar = props.aoLancar ?? vi.fn();
  render(
    <MemoryRouter initialEntries={[rota]}>
      <TrilhoNavegacao aoLancar={aoLancar} mes={props.mes} />
    </MemoryRouter>,
  );
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
  return { nav, aoLancar };
}

describe('TrilhoNavegacao', () => {
  it('mostra a marca Controle em Casa', () => {
    const { nav } = renderizar('/app');
    expect(within(nav).getByText('Controle em Casa')).toBeInTheDocument();
  });

  it('"Lançar" vem no topo, antes da lista', () => {
    const { nav } = renderizar('/app');
    const lancar = within(nav).getByRole('link', { name: 'Lançar' });
    const lista = within(nav).getByRole('list');
    expect(lista.contains(lancar)).toBe(false);
    expect(lancar.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lancar).toHaveAttribute('href', '/app/lancar');
  });

  it('a lista tem 5 itens, com Ajustes por último', () => {
    const { nav } = renderizar('/app');
    const lista = within(nav).getByRole('list');
    const nomes = within(lista)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());
    expect(nomes).toEqual(['Início', 'Lançamentos', 'Orçamento', 'Metas', 'Ajustes']);
  });

  it('em /ajustes/contas só Ajustes fica com aria-current="page"', () => {
    const { nav } = renderizar('/app/ajustes/contas');
    const ativos = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(ativos).toHaveLength(1);
    expect(ativos[0]).toHaveTextContent('Ajustes');
  });

  it('em /app só Início fica ativo (Início não casa com as outras rotas)', () => {
    const { nav } = renderizar('/app');
    const ativos = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(ativos).toHaveLength(1);
    expect(ativos[0]).toHaveTextContent('Início');
  });

  it('clique em "Lançar" chama aoLancar uma vez e impede a navegação', () => {
    const { nav, aoLancar } = renderizar('/app');
    const lancar = within(nav).getByRole('link', { name: 'Lançar' });
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(lancar, evento);
    expect(aoLancar).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('com mes, Início, Lançamentos e Orçamento levam o mês; Metas e Ajustes não', () => {
    const { nav } = renderizar('/app', { mes: '2026-09' });
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/app?mes=2026-09');
    expect(within(nav).getByRole('link', { name: 'Lançamentos' })).toHaveAttribute(
      'href',
      '/app/lancamentos?mes=2026-09',
    );
    expect(within(nav).getByRole('link', { name: 'Orçamento' })).toHaveAttribute('href', '/app/orcamento?mes=2026-09');
    expect(within(nav).getByRole('link', { name: 'Metas' })).toHaveAttribute('href', '/app/metas');
    expect(within(nav).getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/app/ajustes');
  });
});
