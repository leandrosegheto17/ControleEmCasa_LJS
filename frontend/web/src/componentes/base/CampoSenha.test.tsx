import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CampoSenha } from './CampoSenha';

describe('CampoSenha', () => {
  it('campo de senha achado pelo rótulo, oculto por padrão e com autocomplete', () => {
    render(<CampoSenha rotulo="Senha" autoComplete="current-password" />);

    const campo = screen.getByLabelText('Senha');
    expect(campo).toHaveAttribute('type', 'password');
    expect(campo).toHaveAttribute('autocomplete', 'current-password');
    const botao = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    expect(botao).toHaveAttribute('type', 'button');
  });

  it('alternar muda o type, o aria-pressed e o aria-label', async () => {
    const user = userEvent.setup();
    render(<CampoSenha rotulo="Senha" autoComplete="current-password" />);

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
    const ocultar = screen.getByRole('button', { name: 'Ocultar senha' });
    expect(ocultar).toHaveAttribute('aria-pressed', 'true');

    await user.click(ocultar);
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('o botão usa o ícone olho', () => {
    render(<CampoSenha rotulo="Senha" autoComplete="current-password" />);

    const botao = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(botao.querySelector('use')?.getAttribute('href')).toBe('#i-olho');
  });

  it('com erro, liga a mensagem ao campo', () => {
    render(<CampoSenha rotulo="Senha" autoComplete="current-password" erro="Informe a senha" />);

    const campo = screen.getByLabelText('Senha');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Informe a senha');
  });
});
