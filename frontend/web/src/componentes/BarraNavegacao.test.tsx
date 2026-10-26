import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BarraNavegacao } from './BarraNavegacao';

function renderizar(rota: string, props: { aoLancar?: () => void; mes?: string } = {}) {
  const aoLancar = props.aoLancar ?? vi.fn();
  render(
    <MemoryRouter initialEntries={[rota]}>
      <BarraNavegacao aoLancar={aoLancar} mes={props.mes} />
    </MemoryRouter>,
  );
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
  return { nav, aoLancar };
}

function linksAtivos(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page');
}

describe('BarraNavegacao', () => {
  it('mostra os 5 itens na ordem Início, Lançamentos, Lançar, Orçamento, Metas', () => {
    const { nav } = renderizar('/app');
    const itens = within(nav).getAllByRole('listitem');
    expect(itens).toHaveLength(5);
    const nomes = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());
    expect(nomes).toEqual(['Início', 'Lançamentos', 'Lançar', 'Orçamento', 'Metas']);
  });

  it('não mostra Ajustes', () => {
    const { nav } = renderizar('/app');
    expect(within(nav).queryByRole('link', { name: 'Ajustes' })).toBeNull();
  });

  it('o "+" tem nome acessível "Lançar" e aponta para /lancar', () => {
    const { nav } = renderizar('/app');
    const mais = within(nav).getByRole('link', { name: 'Lançar' });
    expect(mais).toHaveAttribute('href', '/app/lancar');
  });

  it('em /app só Início fica com aria-current="page"', () => {
    const { nav } = renderizar('/app');
    const ativos = linksAtivos(nav);
    expect(ativos).toHaveLength(1);
    expect(ativos[0]).toHaveTextContent('Início');
  });

  it('em /lancamentos/abc só Lançamentos fica ativo', () => {
    const { nav } = renderizar('/app/lancamentos/abc');
    const ativos = linksAtivos(nav);
    expect(ativos).toHaveLength(1);
    expect(ativos[0]).toHaveTextContent('Lançamentos');
  });

  it('em /metas só Metas fica ativo', () => {
    const { nav } = renderizar('/app/metas');
    const ativos = linksAtivos(nav);
    expect(ativos).toHaveLength(1);
    expect(ativos[0]).toHaveTextContent('Metas');
  });

  it('clique no "+" chama aoLancar uma vez, de forma síncrona, e impede a navegação', () => {
    const { nav, aoLancar } = renderizar('/app');
    const mais = within(nav).getByRole('link', { name: 'Lançar' });
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(mais, evento);
    expect(aoLancar).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('com mes, os itens que levam o mês recebem ?mes= e Metas não', () => {
    const { nav } = renderizar('/app', { mes: '2026-09' });
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/app?mes=2026-09');
    expect(within(nav).getByRole('link', { name: 'Lançamentos' })).toHaveAttribute(
      'href',
      '/app/lancamentos?mes=2026-09',
    );
    expect(within(nav).getByRole('link', { name: 'Orçamento' })).toHaveAttribute('href', '/app/orcamento?mes=2026-09');
    expect(within(nav).getByRole('link', { name: 'Metas' })).toHaveAttribute('href', '/app/metas');
  });

  it('sem mes, os links não têm parâmetro', () => {
    const { nav } = renderizar('/app');
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/app');
    expect(within(nav).getByRole('link', { name: 'Lançamentos' })).toHaveAttribute('href', '/app/lancamentos');
  });

  it('os ícones são decorativos', () => {
    const { nav } = renderizar('/app');
    const svgs = nav.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(5);
    svgs.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
  });
});
