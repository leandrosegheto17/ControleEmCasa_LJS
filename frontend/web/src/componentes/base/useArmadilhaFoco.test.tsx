import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useArmadilhaFoco } from './useArmadilhaFoco';

function Conteiner({ ativo, aoEsc }: { ativo: boolean; aoEsc: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useArmadilhaFoco(ref, ativo, aoEsc);
  return (
    <>
      <button type="button">Fora antes</button>
      <div ref={ref}>
        <button type="button">Primeiro</button>
        <input aria-label="Meio" />
        <button type="button">Último</button>
      </div>
      <button type="button">Fora depois</button>
    </>
  );
}

describe('useArmadilhaFoco', () => {
  it('Tab no último volta ao primeiro', async () => {
    const usuario = userEvent.setup();
    render(<Conteiner ativo aoEsc={vi.fn()} />);
    screen.getByRole('button', { name: 'Último' }).focus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus();
  });

  it('Shift+Tab no primeiro vai ao último', async () => {
    const usuario = userEvent.setup();
    render(<Conteiner ativo aoEsc={vi.fn()} />);
    screen.getByRole('button', { name: 'Primeiro' }).focus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();
  });

  it('Tab no meio segue a ordem normal', async () => {
    const usuario = userEvent.setup();
    render(<Conteiner ativo aoEsc={vi.fn()} />);
    screen.getByRole('button', { name: 'Primeiro' }).focus();
    await usuario.tab();
    expect(screen.getByLabelText('Meio')).toHaveFocus();
  });

  it('Esc chama aoEsc', async () => {
    const usuario = userEvent.setup();
    const aoEsc = vi.fn();
    render(<Conteiner ativo aoEsc={aoEsc} />);
    screen.getByLabelText('Meio').focus();
    await usuario.keyboard('{Escape}');
    expect(aoEsc).toHaveBeenCalledTimes(1);
  });

  it('inativa não prende o foco nem chama aoEsc', async () => {
    const usuario = userEvent.setup();
    const aoEsc = vi.fn();
    render(<Conteiner ativo={false} aoEsc={aoEsc} />);
    screen.getByRole('button', { name: 'Último' }).focus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fora depois' })).toHaveFocus();
    await usuario.keyboard('{Escape}');
    expect(aoEsc).not.toHaveBeenCalled();
  });

  it('remove os ouvintes ao desmontar', async () => {
    const usuario = userEvent.setup();
    const aoEsc = vi.fn();
    const { unmount } = render(<Conteiner ativo aoEsc={aoEsc} />);
    unmount();
    await usuario.keyboard('{Escape}');
    expect(aoEsc).not.toHaveBeenCalled();
  });
});
