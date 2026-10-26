import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaisDetalhes } from './MaisDetalhes';

function montar(data: string) {
  const aoMudarData = vi.fn();
  const resultado = render(<MaisDetalhes data={data} aoMudarData={aoMudarData} />);
  return { aoMudarData, ...resultado };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 09/10/2026 às 23h30 em São Paulo
  vi.setSystemTime(new Date('2026-10-10T02:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MaisDetalhes', () => {
  it('vem recolhido num <details> nativo', () => {
    const { container } = montar('2026-10-09');

    const detalhes = container.querySelector('details');
    expect(detalhes).not.toBeNull();
    expect(detalhes).not.toHaveAttribute('open');
  });

  it('resumo "(data: hoje)" quando a data é hoje em São Paulo', () => {
    const { container } = montar('2026-10-09');

    expect(container.querySelector('summary')).toHaveTextContent('Mais detalhes (data: hoje)');
  });

  it('outra data aparece em dd/mm/aaaa no resumo', () => {
    const { container } = montar('2026-10-05');

    expect(container.querySelector('summary')).toHaveTextContent('Mais detalhes (data: 05/10/2026)');
  });

  it('campo "Data" (id data, type date) com o valor recebido', () => {
    montar('2026-10-09');

    const data = screen.getByLabelText('Data');
    expect(data).toHaveAttribute('id', 'data');
    expect(data).toHaveAttribute('type', 'date');
    expect(data).toHaveValue('2026-10-09');
  });

  it('mudar a data chama aoMudarData', () => {
    const { aoMudarData } = montar('2026-10-09');

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-05' } });

    expect(aoMudarData).toHaveBeenCalledWith('2026-10-05');
  });
});
