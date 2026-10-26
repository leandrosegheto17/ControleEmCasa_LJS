import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinhasValores } from './LinhasValores';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

describe('LinhasValores', () => {
  it('dl.linhas com um par dt/dd por linha, na ordem recebida', () => {
    const { container } = render(
      <LinhasValores
        linhas={[
          { rotulo: 'Variáveis da casa', valor: 'R$ 1.136,20' },
          { rotulo: 'Previsto a pagar (fixas pendentes)', valor: 'R$ 1.540,00' },
        ]}
      />,
    );

    const dl = container.querySelector('dl') as HTMLElement;
    expect(dl.className).toMatch(classe('linhas'));
    expect(Array.from(dl.querySelectorAll('dt')).map((d) => d.textContent)).toEqual([
      'Variáveis da casa',
      'Previsto a pagar (fixas pendentes)',
    ]);
    expect(screen.getByText('Variáveis da casa').nextElementSibling).toHaveTextContent('R$ 1.136,20');
  });

  it('o dd tem a classe valor', () => {
    render(<LinhasValores linhas={[{ rotulo: 'Receitas', valor: 'R$ 7.500,00' }]} />);

    const dd = screen.getByText('R$ 7.500,00').closest('dd') as HTMLElement;
    expect(dd.className).toMatch(classe('valor'));
  });
});
