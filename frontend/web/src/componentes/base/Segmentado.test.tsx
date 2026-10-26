import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Segmentado } from './Segmentado';

const opcoes = [
  { valor: 'despesa', rotulo: 'Despesa' },
  { valor: 'receita', rotulo: 'Receita', desabilitada: true },
];

function montar(aoMudar = vi.fn()) {
  render(<Segmentado legenda="Tipo de lançamento" nome="tipo" opcoes={opcoes} valor="despesa" aoMudar={aoMudar} />);
  return aoMudar;
}

describe('Segmentado', () => {
  it('fieldset com legenda oculta que nomeia o grupo', () => {
    montar();

    const grupo = screen.getByRole('group', { name: 'Tipo de lançamento' });
    expect(grupo.tagName).toBe('FIELDSET');
    const legenda = grupo.querySelector('legend');
    expect(legenda).toHaveTextContent('Tipo de lançamento');
    expect(legenda?.className).toMatch(/visualmente-oculto/);
  });

  it('rádios nativos com o valor marcado', () => {
    montar();

    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Receita' })).not.toBeChecked();
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('name') === 'tipo')).toBe(true);
  });

  it('opção desabilitada fica disabled e não muda o valor', async () => {
    const user = userEvent.setup();
    const aoMudar = montar();

    const receita = screen.getByRole('radio', { name: 'Receita' });
    expect(receita).toBeDisabled();
    await user.click(receita);

    expect(aoMudar).not.toHaveBeenCalled();
  });
});
