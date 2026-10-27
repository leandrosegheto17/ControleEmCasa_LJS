import { describe, expect, it, vi } from 'vitest';
import {
  ICONE_NOTIFICACAO,
  registrarHandlersPush,
  type EscopoPush,
  type EventoCliqueNotificacao,
  type EventoPush,
} from './handlersPush';

/** Os handlers do service worker contra um `self` simulado. Critérios: RN-27, CA-27.7, G-36, ADR 014. */

const ORIGEM = 'https://controle.exemplo.com.br';

function criarEscopo(
  janelas: Array<{ url: string; focus?: () => Promise<void>; navigate?: (u: string) => Promise<void> }> = [],
) {
  const ouvintes = new Map<string, (evento: never) => void>();
  const showNotification = vi.fn(async (_titulo: string, _opcoes: NotificationOptions) => undefined);
  const openWindow = vi.fn(async (_url: string) => undefined);
  const escopo: EscopoPush = {
    location: { origin: ORIGEM },
    registration: { showNotification },
    clients: {
      matchAll: vi.fn(async () => janelas.map((j) => ({ focus: async () => undefined, ...j }))),
      openWindow,
    },
    addEventListener: (tipo, ouvinte) => void ouvintes.set(tipo, ouvinte),
  };
  registrarHandlersPush(escopo);
  return { escopo, ouvintes, showNotification, openWindow };
}

function enviarPush(ouvintes: Map<string, (e: never) => void>, texto: string | null | (() => string)) {
  const esperas: Array<Promise<unknown>> = [];
  const data = texto === null ? null : { text: typeof texto === 'function' ? texto : () => texto };
  const evento: EventoPush = { data, waitUntil: (p) => void esperas.push(p) };
  ouvintes.get('push')!(evento as never);
  return Promise.all(esperas);
}

function clicar(ouvintes: Map<string, (e: never) => void>, dados: unknown) {
  const esperas: Array<Promise<unknown>> = [];
  const fechar = vi.fn();
  const evento: EventoCliqueNotificacao = {
    notification: { close: fechar, data: dados },
    waitUntil: (p) => void esperas.push(p),
  };
  ouvintes.get('notificationclick')!(evento as never);
  return Promise.all(esperas).then(() => fechar);
}

describe('service worker: push', () => {
  it('registra os dois handlers', () => {
    const { ouvintes } = criarEscopo();
    expect([...ouvintes.keys()].sort()).toEqual(['notificationclick', 'push']);
  });

  it('mostra a notificação com título, corpo, ícone do app, tag do tipo e a url nos dados', async () => {
    const { ouvintes, showNotification } = criarEscopo();

    await enviarPush(
      ouvintes,
      JSON.stringify({ titulo: 'Meta atingida', corpo: 'Uma meta chegou ao valor planejado.', url: '/app/metas' }),
    );

    expect(showNotification).toHaveBeenCalledWith('Meta atingida', {
      body: 'Uma meta chegou ao valor planejado.',
      tag: 'metas',
      icon: ICONE_NOTIFICACAO,
      data: { url: '/app/metas' },
    });
  });

  it.each([
    ['sem dados', null],
    ['texto que não é JSON', 'lixo'],
    ['JSON sem título', JSON.stringify({ corpo: 'x' })],
    [
      'leitura que lança',
      () => {
        throw new Error('falhou');
      },
    ],
  ])('carga inválida (%s) é ignorada sem quebrar', async (_nome, texto) => {
    const { ouvintes, showNotification } = criarEscopo();
    await expect(enviarPush(ouvintes, texto as string | null)).resolves.toBeDefined();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('falha ao mostrar a notificação não quebra o worker', async () => {
    const { ouvintes, showNotification } = criarEscopo();
    showNotification.mockRejectedValueOnce(new Error('sem permissão'));
    await expect(enviarPush(ouvintes, JSON.stringify({ titulo: 'a', corpo: 'b' }))).resolves.toBeDefined();
  });

  it('url de fora de /app/ na carga vira /app/ nos dados da notificação', async () => {
    const { ouvintes, showNotification } = criarEscopo();
    await enviarPush(ouvintes, JSON.stringify({ titulo: 'a', corpo: 'b', url: 'https://mau.example/' }));
    expect(showNotification.mock.calls[0]?.[1]).toMatchObject({ data: { url: '/app/' } });
  });
});

describe('service worker: notificationclick', () => {
  it('fecha a notificação, foca a janela do app já aberta e navega até a url', async () => {
    const focus = vi.fn(async () => undefined);
    const navigate = vi.fn(async (_url: string) => undefined);
    const { ouvintes, openWindow } = criarEscopo([
      { url: 'https://outro.example/app/' },
      { url: `${ORIGEM}/app/lancamentos`, focus, navigate },
    ]);

    const fechar = await clicar(ouvintes, { url: '/app/fixas' });

    expect(fechar).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/app/fixas');
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('sem janela do app aberta, abre uma nova', async () => {
    const { ouvintes, openWindow } = criarEscopo([{ url: `${ORIGEM}/` }]);
    await clicar(ouvintes, { url: '/app/metas' });
    expect(openWindow).toHaveBeenCalledWith('/app/metas');
  });

  it('janela que não consegue navegar: abre uma nova', async () => {
    const { ouvintes, openWindow } = criarEscopo([
      {
        url: `${ORIGEM}/app/`,
        navigate: async () => {
          throw new Error('sem controle');
        },
      },
    ]);
    await clicar(ouvintes, { url: '/app/lancar' });
    expect(openWindow).toHaveBeenCalledWith('/app/lancar');
  });

  it.each([
    ['URL absoluta de outro site', { url: 'https://mau.example/app/x' }],
    ['protocol-relative', { url: '//mau.example/app/x' }],
    ['fora de /app/', { url: '/entrar' }],
    ['sem url', {}],
    ['sem dados', undefined],
  ])('url inaceitável (%s) leva a /app/', async (_nome, dados) => {
    const { ouvintes, openWindow } = criarEscopo();
    await clicar(ouvintes, dados);
    expect(openWindow).toHaveBeenCalledWith('/app/');
  });
});
