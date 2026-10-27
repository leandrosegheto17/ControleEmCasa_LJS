import { vi } from 'vitest';
import { iniciarInstalacao } from '../../src/pwa/instalacao';
import { criarServidor, json, responder, sessao, type Chamada, type Servidor } from './apiCadastros';

/**
 * API simulada do Web Push (etapa 15, lote 2), por cima da de cadastros, e navegador simulado (`Notification`,
 * `PushManager`, `serviceWorker`). As regras seguem o contrato do lote 1 (RN-27): chave pública, assinaturas e preferências.
 */

export const CHAVE_PUBLICA = 'BAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-P0A';

export interface ServidorPush {
  base: Servidor;
  chamadas: Chamada[];
  preferencias: { fixas: boolean; lembrete_diario: boolean; lembrete_hora: number; metas: boolean };
  /** Resposta forçada por rota: `chave`, `assinar`, `remover`, `salvar`. */
  falhas: Partial<Record<'chave' | 'assinar' | 'remover' | 'salvar', { status: number; code: string } | 'rede'>>;
  assinaturas: string[];
  /** Ordem dos eventos relevantes (para conferir que o DELETE vem antes de revogar a sessão). */
  ordem: string[];
}

export function criarServidorPush(parcial: Partial<ServidorPush> = {}): ServidorPush {
  return {
    base: criarServidor(),
    chamadas: [],
    preferencias: { fixas: true, lembrete_diario: false, lembrete_hora: 20, metas: true },
    falhas: {},
    assinaturas: [],
    ordem: [],
    ...parcial,
  };
}

export function instalarApiPush(s: ServidorPush): void {
  const simulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    const chamada = { metodo, url, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> };
    s.chamadas.push(chamada);
    s.base.chamadas.push(chamada);

    const forcada = (rota: keyof ServidorPush['falhas']) => {
      const f = s.falhas[rota];
      if (f === 'rede') throw new TypeError('Failed to fetch');
      return f ? json({ code: f.code, message: 'x' }, f.status) : null;
    };

    if (url === '/api/sessao' && metodo === 'GET') return json(sessao('pro'));
    if (url === '/api/push/chave' && metodo === 'GET')
      return forcada('chave') ?? json({ chave_publica: CHAVE_PUBLICA });
    if (url === '/api/push/assinaturas' && metodo === 'POST') {
      const falha = forcada('assinar');
      if (falha) return falha;
      s.assinaturas.push(String(corpo?.endpoint));
      return new Response(null, { status: 204 });
    }
    if (url === '/api/push/assinaturas' && metodo === 'DELETE') {
      s.ordem.push('delete_assinatura');
      const falha = forcada('remover');
      if (falha) return falha;
      s.assinaturas = s.assinaturas.filter((e) => e !== corpo?.endpoint);
      return new Response(null, { status: 204 });
    }
    if (url === '/api/notificacoes/preferencias' && metodo === 'GET') return json(s.preferencias);
    if (url === '/api/notificacoes/preferencias' && metodo === 'PUT') {
      const falha = forcada('salvar');
      if (falha) return falha;
      s.preferencias = corpo as ServidorPush['preferencias'];
      return new Response(null, { status: 204 });
    }
    if (url === '/api/sessao/sair' && metodo === 'POST') {
      s.ordem.push('sair');
      return new Response(null, { status: 204 });
    }
    return responder(s.base, metodo, url, corpo);
  });
  vi.stubGlobal('fetch', simulado);
}

export const chamadasDePush = (s: ServidorPush) =>
  s.chamadas.filter((c) => c.url.startsWith('/api/push/') || c.url.startsWith('/api/notificacoes/'));

export const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

export interface NavegadorPush {
  permissao: 'default' | 'granted' | 'denied';
  /** Resposta do pedido de permissão. */
  respostaDoPedido: 'default' | 'granted' | 'denied';
  pedidos: number;
  inscricao: ReturnType<typeof criarInscricao> | null;
  subscribe: ReturnType<typeof vi.fn>;
  desfazer: () => void;
}

function criarInscricao() {
  return {
    endpoint: ENDPOINT,
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({ endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: 'p256dh-x', auth: 'auth-x' } }),
  };
}

/** Simula o navegador com suporte a push. `inscrito` já parte com inscrição neste aparelho. */
export function simularNavegadorPush(
  parcial: {
    permissao?: NavegadorPush['permissao'];
    inscrito?: boolean;
    respostaDoPedido?: NavegadorPush['permissao'];
  } = {},
): NavegadorPush {
  const estado: NavegadorPush = {
    permissao: parcial.permissao ?? 'default',
    respostaDoPedido: parcial.respostaDoPedido ?? 'granted',
    pedidos: 0,
    inscricao: parcial.inscrito ? criarInscricao() : null,
    subscribe: vi.fn(),
    desfazer: () => undefined,
  };
  estado.subscribe.mockImplementation(async () => {
    estado.inscricao = criarInscricao();
    return estado.inscricao;
  });
  const gerenciador = {
    getSubscription: async () => estado.inscricao,
    subscribe: estado.subscribe,
  };
  const registro = { pushManager: gerenciador };
  const Notificacao = {
    get permission() {
      return estado.permissao;
    },
    requestPermission: vi.fn(async () => {
      estado.pedidos += 1;
      estado.permissao = estado.respostaDoPedido;
      return estado.respostaDoPedido;
    }),
  };
  vi.stubGlobal('Notification', Notificacao);
  vi.stubGlobal('PushManager', class {});
  const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registro), getRegistration: async () => registro },
  });
  estado.desfazer = () => {
    if (original) Object.defineProperty(navigator, 'serviceWorker', original);
    else Reflect.deleteProperty(navigator, 'serviceWorker');
  };
  return estado;
}

/** O estado de instalação é guardado no módulo: depois de mudar o `userAgent`, recalcula (as telas não importam `pwa/`). */
export const recalcularInstalacao = iniciarInstalacao;
