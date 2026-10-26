import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EstadoVazio } from './EstadoVazio';

describe('EstadoVazio', () => {
  it('mostra o título como cabeçalho', () => {
    render(<EstadoVazio icone="lista" titulo="Nada por aqui" />);
    expect(screen.getByRole('heading', { name: 'Nada por aqui' })).toBeInTheDocument();
  });

  it('não renderiza parágrafo sem texto', () => {
    const { container } = render(<EstadoVazio icone="lista" titulo="Nada por aqui" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('renderiza o texto quando informado', () => {
    render(<EstadoVazio icone="lista" titulo="Nada por aqui" texto="Cadastre o primeiro item." />);
    expect(screen.getByText('Cadastre o primeiro item.')).toBeInTheDocument();
  });

  it('renderiza o slot de ação', () => {
    render(<EstadoVazio icone="lista" titulo="Nada" acao={<button type="button">Adicionar</button>} />);
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
  });

  it('renderiza o ícone', () => {
    const { container } = render(<EstadoVazio icone="lista" titulo="Nada" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('não é um alerta', () => {
    render(<EstadoVazio icone="lista" titulo="Nada" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
