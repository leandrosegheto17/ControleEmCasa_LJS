import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calcularFolga, observarFolga } from './folgaTeclado';

class VisualViewportFalso extends EventTarget {
  constructor(
    public height: number,
    public offsetTop = 0,
  ) {
    super();
  }
}

const alturaOriginal = window.innerHeight;

function definirViewport(valor: VisualViewportFalso | undefined) {
  Object.defineProperty(window, 'visualViewport', { value: valor, configurable: true, writable: true });
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
});

afterEach(() => {
  definirViewport(undefined);
  Object.defineProperty(window, 'innerHeight', { value: alturaOriginal, configurable: true, writable: true });
});

describe('calcularFolga', () => {
  it('sem teclado a folga é 0', () => {
    expect(calcularFolga(800, 800, 0)).toBe(0);
  });

  it('teclado de 300 px dá 300', () => {
    expect(calcularFolga(800, 500, 0)).toBe(300);
  });

  it('com offsetTop (rolagem do iOS) conta só a altura de fato coberta', () => {
    expect(calcularFolga(800, 500, 100)).toBe(200);
  });

  it('nunca é negativa', () => {
    expect(calcularFolga(800, 820, 0)).toBe(0);
  });
});

describe('observarFolga', () => {
  it('sem visualViewport a folga é 0 e não lança', () => {
    definirViewport(undefined);
    const el = document.createElement('div');
    let cancelar: () => void = () => {};
    expect(() => {
      cancelar = observarFolga(el);
    }).not.toThrow();
    expect(el.style.getPropertyValue('--folga-teclado') || '0px').toBe('0px');
    expect(() => cancelar()).not.toThrow();
  });

  it('resize do visualViewport atualiza --folga-teclado no elemento', () => {
    const vv = new VisualViewportFalso(800);
    definirViewport(vv);
    const el = document.createElement('div');
    const cancelar = observarFolga(el);

    vv.height = 500;
    vv.dispatchEvent(new Event('resize'));
    expect(el.style.getPropertyValue('--folga-teclado')).toBe('300px');

    vv.offsetTop = 100;
    vv.dispatchEvent(new Event('scroll'));
    expect(el.style.getPropertyValue('--folga-teclado')).toBe('200px');

    cancelar();
  });

  it('o cancelamento remove os listeners', () => {
    const vv = new VisualViewportFalso(800);
    definirViewport(vv);
    const remover = vi.spyOn(vv, 'removeEventListener');
    const el = document.createElement('div');
    const cancelar = observarFolga(el);

    cancelar();
    expect(remover.mock.calls.map(([tipo]) => tipo).sort()).toEqual(['resize', 'scroll']);

    vv.height = 400;
    vv.dispatchEvent(new Event('resize'));
    expect(el.style.getPropertyValue('--folga-teclado')).not.toBe('400px');
  });
});
