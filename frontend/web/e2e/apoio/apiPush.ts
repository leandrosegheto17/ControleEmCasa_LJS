import type { Page } from '@playwright/test';
import { ID_USUARIO } from './apiPlano';

/**
 * Web Push simulado para os e2e do front (etapa 15, lote 2): a API por `page.route` (chave, assinaturas, preferências) e o
 * navegador por um script de página (`Notification`, `PushManager`, `serviceWorker`). Não prova entrega real de push: isso
 * é a validação com navegador e serviço reais, fora da suíte.
 */

export const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-endpoint';
export const CHAVE_PUBLICA = 'BAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-P0A';

export interface EscritaPush {
  metodo: string;
  url: string;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

const json = (corpo: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(corpo),
});

/** Instala o navegador simulado antes de a página carregar. `respostaDoPedido` é o que o diálogo de permissão devolve. */
export async function simularNavegadorPush(
  page: Page,
  opcoes: { permissao?: 'default' | 'granted' | 'denied'; respostaDoPedido?: 'granted' | 'denied' } = {},
) {
  await page.addInitScript(
    ({ permissao, resposta, endpoint }) => {
      const w = window as unknown as Record<string, unknown>;
      const estado = { permissao, pedidos: 0, inscricao: null as null | { endpoint: string }, desinscricoes: 0 };
      w.__push = estado;
      const inscricao = () => ({
        endpoint,
        toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p256dh-e2e', auth: 'auth-e2e' } }),
        unsubscribe: async () => {
          estado.inscricao = null;
          estado.desinscricoes += 1;
          return true;
        },
      });
      const registro = {
        pushManager: {
          getSubscription: async () => estado.inscricao,
          subscribe: async (opcoesAssinar: { userVisibleOnly: boolean }) => {
            if (!opcoesAssinar.userVisibleOnly) throw new Error('userVisibleOnly');
            const nova = inscricao();
            estado.inscricao = nova;
            return nova;
          },
        },
      };
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          get permission() {
            return estado.permissao;
          },
          requestPermission: async () => {
            estado.pedidos += 1;
            estado.permissao = resposta;
            return resposta;
          },
        },
      });
      Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          ready: Promise.resolve(registro),
          getRegistration: async () => registro,
          register: async () => registro,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
      });
    },
    { permissao: opcoes.permissao ?? 'default', resposta: opcoes.respostaDoPedido ?? 'granted', endpoint: ENDPOINT },
  );
}

export async function simularApiPush(page: Page) {
  const estado = {
    preferencias: { fixas: true, lembrete_diario: false, lembrete_hora: 20, metas: true },
    assinaturas: [] as string[],
  };
  const escritas: EscritaPush[] = [];
  const chamadas: string[] = [];

  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const { pathname } = new URL(pedido.url());
    const metodo = pedido.method();
    const corpo = metodo === 'GET' ? undefined : (pedido.postDataJSON() as Record<string, unknown> | null);
    if (metodo !== 'GET') escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });

    if (pathname === '/api/sessao' && metodo === 'GET')
      return rota.fulfill(
        json({
          usuario: { id: ID_USUARIO, nome: 'Ana', email: 'ana@exemplo.com' },
          membro: { id: ID_USUARIO, nome: 'Ana', papel: 'titular' },
          lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
          plano: 'pro',
          termos_pendentes: false,
        }),
      );
    if (pathname === '/api/push/chave') {
      chamadas.push('chave');
      return rota.fulfill(json({ chave_publica: CHAVE_PUBLICA }));
    }
    if (pathname === '/api/push/assinaturas' && metodo === 'POST') {
      estado.assinaturas.push(String(corpo?.endpoint));
      return rota.fulfill({ status: 204 });
    }
    if (pathname === '/api/push/assinaturas' && metodo === 'DELETE') {
      estado.assinaturas = estado.assinaturas.filter((e) => e !== corpo?.endpoint);
      return rota.fulfill({ status: 204 });
    }
    if (pathname === '/api/notificacoes/preferencias' && metodo === 'GET')
      return rota.fulfill(json(estado.preferencias));
    if (pathname === '/api/notificacoes/preferencias' && metodo === 'PUT') {
      estado.preferencias = corpo as typeof estado.preferencias;
      return rota.fulfill({ status: 204 });
    }
    return rota.fallback();
  });

  return { estado, escritas, chamadas };
}
