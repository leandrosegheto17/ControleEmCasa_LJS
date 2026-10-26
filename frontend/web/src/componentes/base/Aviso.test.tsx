import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Aviso } from './Aviso';

describe('Aviso', () => {
  it.each([
    ['sucesso', '#i-ok'],
    ['guardado', '#i-envio'],
    ['erro', '#i-alerta'],
  ] as const)('tipo %s usa o ícone %s, decorativo', (tipo, href) => {
    const { container } = render(<Aviso tipo={tipo} mensagem="Mensagem" />);
    expect(container.querySelector('use')?.getAttribute('href')).toBe(href);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('mostra a mensagem como texto', () => {
    render(<Aviso tipo="guardado" mensagem="Guardado no aparelho. Será enviado quando houver conexão." />);
    expect(screen.getByText('Guardado no aparelho. Será enviado quando houver conexão.')).toBeInTheDocument();
  });

  it('não interpreta HTML na mensagem', () => {
    const { container } = render(<Aviso tipo="erro" mensagem="<img src=x>" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x>')).toBeInTheDocument();
  });
});
