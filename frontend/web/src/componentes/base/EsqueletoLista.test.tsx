import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EsqueletoLista } from './EsqueletoLista';

function raiz(container: HTMLElement) {
  const elemento = container.firstElementChild;
  if (!(elemento instanceof HTMLElement)) throw new Error('EsqueletoLista não renderizou nada');
  return elemento;
}

describe('EsqueletoLista', () => {
  it('renderiza N linhas', () => {
    const { container } = render(<EsqueletoLista linhas={3} />);
    expect(raiz(container).children).toHaveLength(3);
  });

  it('respeita outro número de linhas', () => {
    const { container } = render(<EsqueletoLista linhas={4} />);
    expect(raiz(container).children).toHaveLength(4);
  });

  it('a última linha é curta e as demais não', () => {
    const { container } = render(<EsqueletoLista linhas={3} />);
    const linhas = Array.from(raiz(container).children);
    expect(linhas.at(-1)?.className).toMatch(/curta/i);
    for (const linha of linhas.slice(0, -1)) expect(linha.className).not.toMatch(/curta/i);
  });

  it('fica escondido da tecnologia assistiva', () => {
    const { container } = render(<EsqueletoLista linhas={3} />);
    expect(raiz(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('não tem conteúdo de texto', () => {
    const { container } = render(<EsqueletoLista linhas={3} />);
    expect(raiz(container).textContent).toBe('');
  });
});
