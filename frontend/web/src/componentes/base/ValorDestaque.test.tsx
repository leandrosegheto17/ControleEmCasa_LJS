import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RotuloParcial } from './RotuloParcial';
import { ValorDestaque } from './ValorDestaque';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

describe('ValorDestaque', () => {
  it('241870 centavos → "R$ 2.418,70" no p.valor-destaque', () => {
    render(<ValorDestaque centavos={241870} />);

    const valor = screen.getByText('R$ 2.418,70');
    expect(valor.tagName).toBe('P');
    expect(valor.className).toMatch(classe('valor-destaque'));
  });

  it('com parcial, mostra o rótulo "parcial" na mesma linha', () => {
    const { container } = render(<ValorDestaque centavos={241870} parcial />);

    const linha = container.firstElementChild as HTMLElement;
    expect(linha.className).toMatch(classe('linha-destaque'));
    const rotulo = screen.getByText('parcial');
    expect(rotulo.className).toMatch(classe('rotulo-parcial'));
    expect(linha).toContainElement(rotulo);
  });

  it('sem parcial, não há rótulo', () => {
    render(<ValorDestaque centavos={241870} />);

    expect(screen.queryByText('parcial')).toBeNull();
  });

  it('zero vira "R$ 0,00"', () => {
    render(<ValorDestaque centavos={0} />);

    expect(screen.getByText('R$ 0,00')).toBeInTheDocument();
  });
});

describe('RotuloParcial', () => {
  it('renderiza "parcial" com a classe do mockup', () => {
    render(<RotuloParcial />);

    expect(screen.getByText('parcial').className).toMatch(classe('rotulo-parcial'));
  });
});
