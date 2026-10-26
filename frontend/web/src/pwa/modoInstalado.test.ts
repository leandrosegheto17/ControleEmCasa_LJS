import { afterEach, describe, expect, it, vi } from 'vitest';
import { estaInstalado } from './modoInstalado';

function simularMatchMedia(standalone: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((consulta: string) => ({
      matches: standalone && consulta === '(display-mode: standalone)',
      media: consulta,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function simularStandaloneIos(valor: boolean | undefined) {
  Object.defineProperty(window.navigator, 'standalone', { value: valor, configurable: true });
}

describe('estaInstalado', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    simularStandaloneIos(undefined);
  });

  it('display-mode standalone → instalado', () => {
    simularMatchMedia(true);
    expect(estaInstalado()).toBe(true);
  });

  it('navigator.standalone (iOS) → instalado', () => {
    simularMatchMedia(false);
    simularStandaloneIos(true);
    expect(estaInstalado()).toBe(true);
  });

  it('nenhum dos dois → não instalado', () => {
    simularMatchMedia(false);
    simularStandaloneIos(undefined);
    expect(estaInstalado()).toBe(false);
  });
});
