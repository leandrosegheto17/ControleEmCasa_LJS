import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SeletorMes } from './SeletorMes';

const iconeDe = (el: Element) => el.querySelector('use')?.getAttribute('href');

describe('SeletorMes', () => {
  it('mostra o mês por extenso no h1 e os rótulos acessíveis das setas', () => {
    render(<SeletorMes mes="2026-10" aoMudar={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Outubro de 2026' })).toBeInTheDocument();
    const anterior = screen.getByRole('button', { name: 'Mês anterior: setembro de 2026' });
    const proximo = screen.getByRole('button', { name: 'Próximo mês: novembro de 2026' });
    expect(iconeDe(anterior)).toBe('#i-esq');
    expect(iconeDe(proximo)).toBe('#i-dir');
  });

  it('põe os botões antes e depois do título, como no mockup', () => {
    render(<SeletorMes mes="2026-10" aoMudar={vi.fn()} />);

    const anterior = screen.getByRole('button', { name: /Mês anterior/ });
    const titulo = screen.getByRole('heading', { level: 1 });
    const proximo = screen.getByRole('button', { name: /Próximo mês/ });
    expect(anterior.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(titulo.compareDocumentPosition(proximo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('clique em ‹ pede setembro e em › pede novembro', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(<SeletorMes mes="2026-10" aoMudar={aoMudar} />);

    await user.click(screen.getByRole('button', { name: /Mês anterior/ }));
    expect(aoMudar).toHaveBeenLastCalledWith('2026-09');

    await user.click(screen.getByRole('button', { name: /Próximo mês/ }));
    expect(aoMudar).toHaveBeenLastCalledWith('2026-11');
    expect(aoMudar).toHaveBeenCalledTimes(2);
  });

  it('atravessa a virada de ano nos rótulos e nos cliques', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(<SeletorMes mes="2027-01" aoMudar={aoMudar} />);

    await user.click(screen.getByRole('button', { name: 'Mês anterior: dezembro de 2026' }));
    expect(aoMudar).toHaveBeenCalledWith('2026-12');
  });

  it('ArrowLeft e ArrowRight com o foco num botão do seletor trocam o mês', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(<SeletorMes mes="2026-10" aoMudar={aoMudar} />);

    screen.getByRole('button', { name: /Mês anterior/ }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(aoMudar).toHaveBeenLastCalledWith('2026-09');

    screen.getByRole('button', { name: /Próximo mês/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(aoMudar).toHaveBeenLastCalledWith('2026-11');
    expect(aoMudar).toHaveBeenCalledTimes(2);
  });

  it('setas com o foco fora do seletor não fazem nada', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Fora</button>
        <SeletorMes mes="2026-10" aoMudar={aoMudar} />
      </>,
    );

    screen.getByRole('button', { name: 'Fora' }).focus();
    await user.keyboard('{ArrowLeft}{ArrowRight}');
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('põe o prefixo oculto dentro do h1', () => {
    render(<SeletorMes mes="2026-10" aoMudar={vi.fn()} prefixoOculto="Lançamentos de " />);

    const titulo = screen.getByRole('heading', { level: 1, name: 'Lançamentos de Outubro de 2026' });
    const oculto = titulo.querySelector('.visualmente-oculto');
    expect(oculto).not.toBeNull();
    expect(oculto).toHaveTextContent('Lançamentos de');
  });

  it('sem prefixo, o h1 não tem texto oculto', () => {
    render(<SeletorMes mes="2026-10" aoMudar={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 }).querySelector('.visualmente-oculto')).toBeNull();
  });
});
