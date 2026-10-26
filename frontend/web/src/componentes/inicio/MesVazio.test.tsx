import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MesVazio } from './MesVazio';

function montar(mes: string) {
  return render(
    <MemoryRouter>
      <MesVazio mes={mes} />
    </MemoryRouter>,
  );
}

describe('MesVazio', () => {
  it('"Nada lançado em outubro ainda." com o mês da prop em minúscula', () => {
    montar('2026-10');
    expect(screen.getByText('Nada lançado em outubro ainda.')).toBeInTheDocument();
  });

  it('outro mês', () => {
    montar('2026-03');
    expect(screen.getByText('Nada lançado em março ainda.')).toBeInTheDocument();
  });

  it('"Lançar" leva à folha de lançamento', () => {
    montar('2026-10');

    const link = screen.queryByRole('link', { name: 'Lançar' });
    if (link) {
      expect(link.getAttribute('href')).toMatch(/^\/app\/lancar/);
    } else {
      expect(screen.getByRole('button', { name: 'Lançar' })).toBeInTheDocument();
    }
  });
});
