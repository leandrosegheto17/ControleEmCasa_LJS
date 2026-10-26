import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FiltrosLancamentos } from './FiltrosLancamentos';

const RESPOSTAS = new URL('../../../test/fixtures/respostas/', import.meta.url);
type Dados = { categorias_despesa: unknown[]; formas: unknown[] };
const DADOS = JSON.parse(readFileSync(new URL('dados-lancamento.json', RESPOSTAS), 'utf8')) as Dados;

const DEBITO_ITAU = '00000000-0000-4000-8000-000000000302';
const MERCADO = '00000000-0000-4000-8000-000000000401';

type Props = ComponentProps<typeof FiltrosLancamentos>;

function renderizar(filtros: Props['filtros'] = {}) {
  const aoMudar = vi.fn();
  render(
    <FiltrosLancamentos
      filtros={filtros}
      aoMudar={aoMudar}
      categorias={DADOS.categorias_despesa as never}
      formas={DADOS.formas as never}
    />,
  );
  const grupo = screen.getByRole('group', { name: 'Filtros' });
  return { grupo, aoMudar };
}

const usoIcone = (el: Element) => el.querySelector('svg use')?.getAttribute('href');

describe('FiltrosLancamentos', () => {
  it('é um grupo com nome "Filtros" e os botões do mockup', () => {
    const { grupo } = renderizar();
    expect(within(grupo).getByRole('button', { name: 'Eu' })).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Casa' })).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Variável' })).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Categoria: todas' })).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Forma: todas' })).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });

  it('ativos têm aria-pressed true e o ícone marcado; inativos, aria-pressed false sem ícone', () => {
    const { grupo } = renderizar({ escopo: 'eu', variavel: true });
    const eu = within(grupo).getByRole('button', { name: 'Eu' });
    const casa = within(grupo).getByRole('button', { name: 'Casa' });
    const variavel = within(grupo).getByRole('button', { name: 'Variável' });

    expect(eu).toHaveAttribute('aria-pressed', 'true');
    expect(usoIcone(eu)).toBe('#i-marcado');
    expect(variavel).toHaveAttribute('aria-pressed', 'true');
    expect(usoIcone(variavel)).toBe('#i-marcado');
    expect(casa).toHaveAttribute('aria-pressed', 'false');
    expect(usoIcone(casa)).toBeUndefined();
  });

  it('Eu com Casa marcado troca para Eu (exclusivos)', () => {
    const { grupo, aoMudar } = renderizar({ escopo: 'casa' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Eu' }));
    expect(aoMudar).toHaveBeenCalledWith({ escopo: 'eu' });
  });

  it('clicar no escopo já marcado desmarca (todos)', () => {
    const { grupo, aoMudar } = renderizar({ escopo: 'casa', variavel: true });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Casa' }));
    expect(aoMudar).toHaveBeenCalledWith({ variavel: true });
  });

  it('Variável liga e desliga', () => {
    const { grupo, aoMudar } = renderizar({});
    fireEvent.click(within(grupo).getByRole('button', { name: 'Variável' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ variavel: true });
  });

  it('forma 302 aparece como "Forma: Débito Itaú", marcada e com aria-haspopup', () => {
    const { grupo } = renderizar({ escopo: 'casa', forma: DEBITO_ITAU });
    const forma = within(grupo).getByRole('button', { name: 'Forma: Débito Itaú' });
    expect(forma).toHaveAttribute('aria-pressed', 'true');
    expect(forma).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('escolher uma categoria na lista chama aoMudar com o id', () => {
    const { grupo, aoMudar } = renderizar({ escopo: 'casa' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Categoria: todas' }));
    fireEvent.click(screen.getByText('Mercado'));
    expect(aoMudar).toHaveBeenCalledWith({ escopo: 'casa', categoria: MERCADO });
  });

  it('a lista de formas só mostra as formas recebidas (as minhas)', () => {
    const { grupo } = renderizar();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Forma: todas' }));
    expect(screen.getByText('Pix Nubank')).toBeInTheDocument();
    expect(screen.getByText('Débito Itaú')).toBeInTheDocument();
    expect(screen.getByText('Cartão de crédito XP')).toBeInTheDocument();
  });

  it('"Limpar filtros" zera tudo', () => {
    const { grupo, aoMudar } = renderizar({ escopo: 'casa', forma: DEBITO_ITAU, variavel: true });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Limpar filtros' }));
    expect(aoMudar).toHaveBeenCalledWith({});
  });
});
