import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { SecaoCategoria } from './SecaoCategoria';

const DADOS: DadosLancamento = JSON.parse(
  readFileSync(new URL('../../../test/fixtures/respostas/dados-lancamento.json', import.meta.url), 'utf8'),
);

function receitas(total: number) {
  return Array.from({ length: total }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000009${String(i).padStart(2, '0')}`,
    nome: `Receita ${i + 1}`,
    escopo: 'individual' as const,
  }));
}

describe('SecaoCategoria com semOutras (receita)', () => {
  it('mostra as 3 categorias de receita na ordem recebida e não mostra "Outras…"', () => {
    render(<SecaoCategoria categorias={DADOS.categorias_receita} valor={null} aoMudar={vi.fn()} semOutras />);

    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.closest('label')?.querySelector('[class*="chip-nome"]')?.textContent ?? '')).toEqual([
      'Salário',
      'Extra',
      'Outros',
    ]);
    expect(screen.queryByRole('button', { name: 'Outras…' })).toBeNull();
  });

  it('cada chip de receita leva o selo "Eu"', () => {
    render(<SecaoCategoria categorias={DADOS.categorias_receita} valor={null} aoMudar={vi.fn()} semOutras />);

    for (const radio of screen.getAllByRole('radio')) {
      const chip = radio.closest('label') as HTMLElement;
      expect(within(chip).getByText('Eu')).toBeInTheDocument();
    }
  });

  it('com 9 receitas mostra as 9, sem "Outras…"', () => {
    render(<SecaoCategoria categorias={receitas(9)} valor={null} aoMudar={vi.fn()} semOutras />);

    expect(screen.getAllByRole('radio')).toHaveLength(9);
    expect(screen.queryByRole('button', { name: 'Outras…' })).toBeNull();
  });

  it('com mais de 9 receitas volta a 8 + "Outras…"', () => {
    render(<SecaoCategoria categorias={receitas(10)} valor={null} aoMudar={vi.fn()} semOutras />);

    expect(screen.getAllByRole('radio')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Outras…' })).toBeInTheDocument();
  });
});
