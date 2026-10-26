import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_PC =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CHAVE_DISPENSA = 'controle.instalar.dispensada';

function simular({ ua, toque = 0, standalone = false }: { ua: string; toque?: number; standalone?: boolean }) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: toque, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
    matches: standalone && consulta.includes('standalone'),
    media: consulta,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function carregar() {
  vi.resetModules();
  const modulo = await import('./instalacao');
  modulo.iniciarInstalacao();
  return modulo;
}

function eventoPromptFalso() {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  evento.prompt = vi.fn().mockResolvedValue(undefined);
  evento.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  return evento;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('plataforma', () => {
  it('iPhone é ios', async () => {
    simular({ ua: UA_IPHONE, toque: 5 });
    const { plataforma } = await carregar();
    expect(plataforma()).toBe('ios');
  });

  it('iPad com UA de Mac e toque é ios', async () => {
    simular({ ua: UA_MAC, toque: 5 });
    const { plataforma } = await carregar();
    expect(plataforma()).toBe('ios');
  });

  it('Mac sem toque não é ios', async () => {
    simular({ ua: UA_MAC, toque: 0 });
    const { plataforma } = await carregar();
    expect(plataforma()).toBe('outra');
  });

  it('Android é android', async () => {
    simular({ ua: UA_ANDROID, toque: 5 });
    const { plataforma } = await carregar();
    expect(plataforma()).toBe('android');
  });

  it('PC é outra e a faixa não aparece', async () => {
    simular({ ua: UA_PC });
    const { plataforma, obter } = await carregar();
    expect(plataforma()).toBe('outra');
    expect(obter().plataforma).toBe('outra');
    expect(obter().mostrarFaixa).toBe(false);
  });
});

describe('mostrarFaixa', () => {
  it('celular no navegador, sem instalar e sem dispensar mostra a faixa', async () => {
    simular({ ua: UA_IPHONE, toque: 5 });
    const { obter } = await carregar();
    expect(obter()).toMatchObject({ plataforma: 'ios', instalado: false, dispensada: false, mostrarFaixa: true });
  });

  it('no modo instalado (standalone) não mostra a faixa', async () => {
    simular({ ua: UA_ANDROID, toque: 5, standalone: true });
    const { obter } = await carregar();
    expect(obter().instalado).toBe(true);
    expect(obter().mostrarFaixa).toBe(false);
  });
});

describe('prompt nativo (beforeinstallprompt)', () => {
  it('guarda o evento, chama preventDefault e liga temPrompt', async () => {
    simular({ ua: UA_ANDROID, toque: 5 });
    const { obter } = await carregar();
    expect(obter().temPrompt).toBe(false);

    const evento = eventoPromptFalso();
    window.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(obter().temPrompt).toBe(true);
    expect(evento.prompt).not.toHaveBeenCalled();
  });

  it('assinar recebe a mudança e cancelar para de receber', async () => {
    simular({ ua: UA_ANDROID, toque: 5 });
    const { assinar } = await carregar();
    const ouvinte = vi.fn();
    const cancelar = assinar(ouvinte);

    window.dispatchEvent(eventoPromptFalso());
    expect(ouvinte).toHaveBeenCalled();

    ouvinte.mockClear();
    cancelar();
    window.dispatchEvent(new Event('appinstalled'));
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('pedirInstalacao chama prompt uma vez, devolve a escolha e zera temPrompt', async () => {
    simular({ ua: UA_ANDROID, toque: 5 });
    const { obter, pedirInstalacao } = await carregar();
    const evento = eventoPromptFalso();
    window.dispatchEvent(evento);

    await expect(pedirInstalacao()).resolves.toMatchObject({ outcome: 'accepted' });
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    expect(obter().temPrompt).toBe(false);

    try {
      await pedirInstalacao();
    } catch {
      // uso único: sem evento guardado, não há o que chamar
    }
    expect(evento.prompt).toHaveBeenCalledTimes(1);
  });

  it('appinstalled marca instalado e some a faixa', async () => {
    simular({ ua: UA_ANDROID, toque: 5 });
    const { obter } = await carregar();
    expect(obter().mostrarFaixa).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));

    expect(obter().instalado).toBe(true);
    expect(obter().mostrarFaixa).toBe(false);
  });
});

describe('dispensar', () => {
  it('grava a marca no localStorage e esconde a faixa', async () => {
    simular({ ua: UA_IPHONE, toque: 5 });
    const { obter, dispensar } = await carregar();

    dispensar();

    expect(localStorage.getItem(CHAVE_DISPENSA)).not.toBeNull();
    expect(obter().dispensada).toBe(true);
    expect(obter().mostrarFaixa).toBe(false);
  });

  it('a marca sobrevive a uma nova iniciarInstalacao (recarregar a página)', async () => {
    simular({ ua: UA_IPHONE, toque: 5 });
    (await carregar()).dispensar();

    const { obter, iniciarInstalacao } = await carregar();
    iniciarInstalacao();

    expect(obter().dispensada).toBe(true);
    expect(obter().mostrarFaixa).toBe(false);
  });

  it('o localStorage guarda só a marca de dispensa', async () => {
    simular({ ua: UA_IPHONE, toque: 5 });
    (await carregar()).dispensar();
    expect(Object.keys(localStorage)).toEqual([CHAVE_DISPENSA]);
  });
});
