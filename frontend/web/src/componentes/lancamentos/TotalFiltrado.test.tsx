import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TotalFiltrado } from './TotalFiltrado';

function regiaoViva(container: HTMLElement) {
  const regiao = container.querySelector('[aria-live="polite"]') as HTMLElement;
  expect(regiao).not.toBeNull();
  return regiao;
}

describe('TotalFiltrado', () => {
  it('mostra "Total filtrado", "· 15 lançamentos" e o valor que veio da API', () => {
    const { container } = render(<TotalFiltrado totalCentavos={84630} quantidade={15} />);
    const regiao = regiaoViva(container);
    expect(regiao).toHaveTextContent('Total filtrado');
    expect(regiao).toHaveTextContent('· 15 lançamentos');
    expect(regiao).toHaveTextContent('R$ 846,30');
  });

  it('singular com 1 lançamento', () => {
    const { container } = render(<TotalFiltrado totalCentavos={4590} quantidade={1} />);
    expect(regiaoViva(container)).toHaveTextContent('· 1 lançamento');
    expect(regiaoViva(container)).not.toHaveTextContent('lançamentos');
  });

  it('zero: "R$ 0,00 · 0 lançamentos"', () => {
    const { container } = render(<TotalFiltrado totalCentavos={0} quantidade={0} />);
    expect(regiaoViva(container)).toHaveTextContent('· 0 lançamentos');
    expect(regiaoViva(container)).toHaveTextContent('R$ 0,00');
  });

  it('a região aria-live existe desde o 1º render e o texto muda dentro dela', () => {
    const { container, rerender } = render(<TotalFiltrado totalCentavos={84630} quantidade={15} />);
    const antes = regiaoViva(container);

    rerender(<TotalFiltrado totalCentavos={4120} quantidade={1} />);

    const depois = regiaoViva(container);
    expect(depois).toBe(antes);
    expect(depois).toHaveTextContent('R$ 41,20');
    expect(depois).toHaveTextContent('· 1 lançamento');
  });
});
