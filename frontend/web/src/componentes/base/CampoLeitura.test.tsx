import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoLeitura } from './CampoLeitura';

describe('CampoLeitura', () => {
  it('liga o rótulo ao texto', () => {
    render(<CampoLeitura rotulo="Saldo atual" texto="R$ 10,00" />);
    const grupo = screen.getByRole('group', { name: 'Saldo atual' });
    expect(grupo).toHaveTextContent('R$ 10,00');
  });

  it('liga a ajuda ao texto', () => {
    render(<CampoLeitura rotulo="Saldo atual" texto="R$ 10,00" ajuda="Calculado pelo servidor." />);
    expect(screen.getByRole('group', { name: 'Saldo atual' })).toHaveAccessibleDescription('Calculado pelo servidor.');
  });
});
