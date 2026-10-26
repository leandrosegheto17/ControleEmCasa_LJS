import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Interruptor } from './Interruptor';

function Controlado(props: { ajuda?: string; desabilitado?: boolean; inicial?: boolean }) {
  const [ligado, setLigado] = useState(props.inicial ?? false);
  return (
    <Interruptor
      rotulo="Despesa variável"
      ajuda={props.ajuda}
      checked={ligado}
      onChange={(e) => setLigado(e.target.checked)}
      desabilitado={props.desabilitado}
    />
  );
}

describe('Interruptor', () => {
  it('é um checkbox com role=switch achado pelo rótulo', () => {
    render(<Controlado />);
    const chave = screen.getByRole('switch', { name: /Despesa variável/ });
    expect(chave).toHaveAttribute('type', 'checkbox');
    expect(screen.getByLabelText(/Despesa variável/)).toBe(chave);
  });

  it('o rótulo envolve o controle', () => {
    render(<Controlado />);
    const chave = screen.getByRole('switch');
    expect(chave.closest('label')).not.toBeNull();
    expect(chave.closest('label')).toHaveTextContent('Despesa variável');
  });

  it('alterna ao clicar', () => {
    render(<Controlado />);
    const chave = screen.getByRole('switch');
    expect(chave).not.toBeChecked();
    fireEvent.click(chave);
    expect(chave).toBeChecked();
    fireEvent.click(chave);
    expect(chave).not.toBeChecked();
  });

  it('alterna ao clicar no texto do rótulo', () => {
    render(<Controlado />);
    fireEvent.click(screen.getByText('Despesa variável'));
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('mostra a ajuda opcional', () => {
    render(<Controlado ajuda="Entra no orçamento como variável" />);
    expect(screen.getByText('Entra no orçamento como variável')).toBeInTheDocument();
  });

  it('desabilitado aplica disabled e não alterna', () => {
    render(<Controlado desabilitado />);
    const chave = screen.getByRole('switch');
    expect(chave).toBeDisabled();
    fireEvent.click(chave);
    expect(chave).not.toBeChecked();
  });
});
