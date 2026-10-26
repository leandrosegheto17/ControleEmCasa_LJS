import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Esqueleto } from './Esqueleto';

const VARIANTES = ['titulo', 'valor', 'linha', 'linha-curta', 'bloco-titulo'] as const;

describe('Esqueleto', () => {
  it.each(VARIANTES)('variante %s aplica a base e a própria classe', (variante) => {
    const { container } = render(<Esqueleto variante={variante} />);
    const elemento = container.firstElementChild;
    expect(elemento).toBeInstanceOf(HTMLElement);
    expect(elemento?.className).toMatch(/esqueleto/);
    if (variante !== 'valor') expect(elemento?.className).toContain(variante);
  });

  it('variantes diferentes geram classes diferentes', () => {
    const classes = VARIANTES.map((variante) => {
      const { container, unmount } = render(<Esqueleto variante={variante} />);
      const classe = container.firstElementChild?.className;
      unmount();
      return classe;
    });
    expect(new Set(classes).size).toBe(VARIANTES.length);
  });

  it('não tem conteúdo de texto', () => {
    const { container } = render(<Esqueleto variante="linha" />);
    expect(container.textContent).toBe('');
  });
});
