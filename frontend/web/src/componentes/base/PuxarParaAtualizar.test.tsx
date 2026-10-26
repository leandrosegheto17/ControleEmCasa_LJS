import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PuxarParaAtualizar } from './PuxarParaAtualizar';

type Ambiente = { toque: boolean; reduzirMovimento: boolean };

function simularMidia({ toque, reduzirMovimento }: Ambiente) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((consulta: string) => ({
      matches:
        (consulta.includes('pointer: coarse') && toque) ||
        (consulta.includes('pointer: fine') && !toque) ||
        (consulta.includes('prefers-reduced-motion: reduce') && reduzirMovimento),
      media: consulta,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function definirRolagem(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  Object.defineProperty(window, 'pageYOffset', { configurable: true, value: y });
}

function montar(aoAtualizar: () => Promise<unknown>) {
  const raiz = document.createElement('div');
  document.body.appendChild(raiz);
  const resultado = render(
    <PuxarParaAtualizar aoAtualizar={aoAtualizar}>
      <p>Conteúdo da página</p>
    </PuxarParaAtualizar>,
    { container: raiz },
  );
  return { ...resultado, alvo: screen.getByText('Conteúdo da página') };
}

function puxar(alvo: Element, deltaY: number, deltaX = 0, dedos = 1) {
  const ponto = (x: number, y: number) =>
    Array.from({ length: dedos }, () => ({ clientX: x, clientY: y, identifier: 0 }));
  fireEvent.touchStart(alvo, { touches: ponto(100, 100), changedTouches: ponto(100, 100) });
  for (let passo = 1; passo <= 4; passo++) {
    const x = 100 + (deltaX * passo) / 4;
    const y = 100 + (deltaY * passo) / 4;
    fireEvent.touchMove(alvo, { touches: ponto(x, y), changedTouches: ponto(x, y) });
  }
  const fim = ponto(100 + deltaX, 100 + deltaY);
  fireEvent.touchEnd(alvo, { touches: [], changedTouches: fim });
}

const anuncio = () => screen.queryByText('Atualizando…');

beforeEach(() => {
  simularMidia({ toque: true, reduzirMovimento: false });
  definirRolagem(0);
  document.documentElement.classList.remove('com-folha');
});

afterEach(() => {
  vi.unstubAllGlobals();
  definirRolagem(0);
  document.documentElement.classList.remove('com-folha');
  document.body.innerHTML = '';
});

describe('PuxarParaAtualizar no celular', () => {
  it('puxar 80 px no topo e soltar chama aoAtualizar uma vez e anuncia até resolver', async () => {
    let terminar: () => void = () => undefined;
    const aoAtualizar = vi.fn(() => new Promise<void>((r) => (terminar = r)));
    const { alvo } = montar(aoAtualizar);

    puxar(alvo, 80);

    expect(aoAtualizar).toHaveBeenCalledTimes(1);
    const status = anuncio();
    expect(status).not.toBeNull();
    expect(status!.closest('[role="status"]')).not.toBeNull();

    await act(async () => terminar());

    expect(anuncio()).toBeNull();
  });

  it('puxar só 30 px não chama', () => {
    const aoAtualizar = vi.fn(async () => undefined);
    const { alvo } = montar(aoAtualizar);
    puxar(alvo, 30);
    expect(aoAtualizar).not.toHaveBeenCalled();
  });

  it('com a página rolada não chama', () => {
    definirRolagem(200);
    const aoAtualizar = vi.fn(async () => undefined);
    const { alvo } = montar(aoAtualizar);
    puxar(alvo, 80);
    expect(aoAtualizar).not.toHaveBeenCalled();
  });

  it('com uma folha aberta não chama', () => {
    document.documentElement.classList.add('com-folha');
    const aoAtualizar = vi.fn(async () => undefined);
    const { alvo } = montar(aoAtualizar);
    puxar(alvo, 80);
    expect(aoAtualizar).not.toHaveBeenCalled();
  });

  it('gesto horizontal não chama', () => {
    const aoAtualizar = vi.fn(async () => undefined);
    const { alvo } = montar(aoAtualizar);
    puxar(alvo, 20, 120);
    expect(aoAtualizar).not.toHaveBeenCalled();
  });

  it('multitoque não chama', () => {
    const aoAtualizar = vi.fn(async () => undefined);
    const { alvo } = montar(aoAtualizar);
    puxar(alvo, 80, 0, 2);
    expect(aoAtualizar).not.toHaveBeenCalled();
  });

  it('novo gesto durante a atualização é ignorado; depois de resolver, volta a funcionar', async () => {
    let terminar: () => void = () => undefined;
    const aoAtualizar = vi.fn(() => new Promise<void>((r) => (terminar = r)));
    const { alvo } = montar(aoAtualizar);

    puxar(alvo, 80);
    puxar(alvo, 80);
    expect(aoAtualizar).toHaveBeenCalledTimes(1);

    await act(async () => terminar());
    puxar(alvo, 80);
    expect(aoAtualizar).toHaveBeenCalledTimes(2);
  });
});

describe('PuxarParaAtualizar no PC', () => {
  it('não registra nenhum listener de toque e o mouse não faz nada', () => {
    simularMidia({ toque: false, reduzirMovimento: false });
    const raiz = document.createElement('div');
    document.body.appendChild(raiz);
    const registrar = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const aoAtualizar = vi.fn(async () => undefined);

    render(
      <PuxarParaAtualizar aoAtualizar={aoAtualizar}>
        <p>Conteúdo da página</p>
      </PuxarParaAtualizar>,
      { container: raiz },
    );

    const deToque = registrar.mock.contexts
      .map((contexto, i) => ({ contexto, tipo: registrar.mock.calls[i][0] }))
      .filter(({ contexto, tipo }) => String(tipo).startsWith('touch') && contexto !== raiz);
    expect(deToque).toEqual([]);

    const alvo = screen.getByText('Conteúdo da página');
    fireEvent.mouseDown(alvo, { clientY: 100 });
    fireEvent.mouseMove(alvo, { clientY: 200 });
    fireEvent.mouseUp(alvo, { clientY: 200 });
    expect(aoAtualizar).not.toHaveBeenCalled();
    registrar.mockRestore();
  });
});

describe('PuxarParaAtualizar com movimento reduzido', () => {
  it('não desloca o indicador nem gira, mas anuncia "Atualizando…"', () => {
    simularMidia({ toque: true, reduzirMovimento: true });
    const aoAtualizar = vi.fn(() => new Promise<void>(() => {}));
    const { alvo, container } = montar(aoAtualizar);

    puxar(alvo, 80);

    expect(aoAtualizar).toHaveBeenCalledTimes(1);
    expect(anuncio()).not.toBeNull();
    for (const elemento of container.querySelectorAll<HTMLElement | SVGElement>('*')) {
      expect(elemento.style?.transform ?? '').not.toMatch(/translate/);
      expect(elemento.getAttribute('class') ?? '').not.toMatch(/giro/);
    }
  });
});

describe('PuxarParaAtualizar em repouso', () => {
  it('não acrescenta nada visível além do conteúdo', () => {
    const { container } = montar(vi.fn(async () => undefined));

    expect(container.textContent).toBe('Conteúdo da página');
    expect(container.querySelector('svg')).toBeNull();
    expect(anuncio()).toBeNull();
  });
});
