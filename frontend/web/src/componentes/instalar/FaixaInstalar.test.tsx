import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FaixaInstalar } from './FaixaInstalar';
import botao from '../base/Botao.module.css';
import botaoIcone from '../base/BotaoIcone.module.css';
import faixaCss from '../base/Faixa.module.css';

function temClasse(el: Element, nome: string) {
  return [...el.classList].some((c) => c === nome || c.startsWith(`_${nome}_`));
}

function renderizar() {
  const aoInstalar = vi.fn();
  const aoDispensar = vi.fn();
  const { container } = render(<FaixaInstalar aoInstalar={aoInstalar} aoDispensar={aoDispensar} />);
  const faixa = screen.getByRole('region', { name: 'Instalar o app' });
  return { faixa, container, aoInstalar, aoDispensar };
}

describe('FaixaInstalar', () => {
  it('é a região "Instalar o app" com o texto do mockup', () => {
    const { faixa } = renderizar();
    expect(faixa).toHaveTextContent('Instale o Controle em Casa para lançar mais rápido.');
    expect(temClasse(faixa, 'faixa')).toBe(true);
  });

  it('mostra o ícone adicionar, decorativo', () => {
    const { faixa } = renderizar();
    const uso = faixa.querySelector('use[href="#i-adicionar"]');
    expect(uso).not.toBeNull();
    expect(uso?.closest('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('"Instalar" chama aoInstalar', () => {
    const { faixa, aoInstalar, aoDispensar } = renderizar();
    fireEvent.click(within(faixa).getByRole('button', { name: 'Instalar' }));
    expect(aoInstalar).toHaveBeenCalledTimes(1);
    expect(aoDispensar).not.toHaveBeenCalled();
  });

  it('o X "Dispensar instalação" chama aoDispensar', () => {
    const { faixa, aoInstalar, aoDispensar } = renderizar();
    fireEvent.click(within(faixa).getByRole('button', { name: 'Dispensar instalação' }));
    expect(aoDispensar).toHaveBeenCalledTimes(1);
    expect(aoInstalar).not.toHaveBeenCalled();
  });

  it('alvos de pelo menos 44 px pela classe, sem style inline', () => {
    const { faixa, container } = renderizar();
    const instalar = within(faixa).getByRole('button', { name: 'Instalar' });
    const dispensar = within(faixa).getByRole('button', { name: 'Dispensar instalação' });
    expect(instalar.classList.contains(botao.botao)).toBe(true);
    expect(instalar.classList.contains(botao.principal)).toBe(true);
    expect(dispensar.classList.contains(botaoIcone.botao)).toBe(true);
    // O min-height do alvo mínimo vem de `.acoes > button`: os botões são filhos diretos de `.acoes`.
    for (const b of [instalar, dispensar]) {
      expect(b.parentElement?.classList.contains(faixaCss.acoes)).toBe(true);
    }
    expect(container.querySelector('[style]')).toBeNull();
  });
});
