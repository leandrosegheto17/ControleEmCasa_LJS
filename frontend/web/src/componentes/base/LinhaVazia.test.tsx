import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinhaVazia } from './LinhaVazia';

describe('LinhaVazia', () => {
  it('renderiza um parágrafo com o texto', () => {
    render(<LinhaVazia>Nenhuma meta cadastrada</LinhaVazia>);
    const texto = screen.getByText('Nenhuma meta cadastrada');
    expect(texto.tagName).toBe('P');
  });

  it('não é um alerta nem um cabeçalho', () => {
    render(<LinhaVazia>Nenhuma meta cadastrada</LinhaVazia>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
