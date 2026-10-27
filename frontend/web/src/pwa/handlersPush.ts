import { escolherJanela, interpretarCarga, urlDoClique, URL_PADRAO } from './cargaPush';

/** Ícone do app na notificação (já está no precache e no manifesto). */
export const ICONE_NOTIFICACAO = '/icones/icone-192.png';

interface JanelaDoApp {
  url: string;
  focus: () => Promise<unknown>;
  navigate?: (url: string) => Promise<unknown>;
}

interface EventoComEspera {
  waitUntil: (promessa: Promise<unknown>) => void;
}

/** O que os handlers usam do `ServiceWorkerGlobalScope`; os testes passam um objeto com este formato. */
export interface EscopoPush {
  location: { origin: string };
  registration: { showNotification: (titulo: string, opcoes: NotificationOptions) => Promise<void> };
  clients: {
    matchAll: (opcoes: { type: 'window'; includeUncontrolled: boolean }) => Promise<readonly JanelaDoApp[]>;
    openWindow: (url: string) => Promise<unknown>;
  };
  addEventListener: (tipo: 'push' | 'notificationclick', ouvinte: (evento: never) => void) => void;
}

export interface EventoPush extends EventoComEspera {
  data: { text: () => string } | null;
}
export interface EventoCliqueNotificacao extends EventoComEspera {
  notification: { close: () => void; data?: unknown };
}

function textoDaCarga(evento: EventoPush): string | null {
  try {
    return evento.data?.text() ?? null;
  } catch {
    return null;
  }
}

/** `push`: carga inválida é ignorada (sem erro); a válida vira uma notificação só de texto. */
export function aoReceberPush(escopo: EscopoPush, evento: EventoPush): void {
  const carga = interpretarCarga(textoDaCarga(evento), escopo.location.origin);
  if (!carga) return;
  evento.waitUntil(
    escopo.registration
      .showNotification(carga.titulo, {
        body: carga.corpo,
        tag: carga.tag,
        icon: ICONE_NOTIFICACAO,
        data: { url: carga.url },
      })
      .catch(() => undefined),
  );
}

/** `notificationclick`: foca a janela do app e navega; sem janela, abre uma. Só vale `url` de `/app/` da mesma origem. */
export function aoClicarNotificacao(escopo: EscopoPush, evento: EventoCliqueNotificacao): void {
  evento.notification.close();
  const dados = evento.notification.data as { url?: unknown } | null | undefined;
  const destino = urlDoClique(dados?.url, escopo.location.origin) ?? URL_PADRAO;
  evento.waitUntil(abrirDestino(escopo, destino));
}

async function abrirDestino(escopo: EscopoPush, destino: string): Promise<void> {
  const janelas = await escopo.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const indice = escolherJanela(
    janelas.map((j) => j.url),
    escopo.location.origin,
  );
  const janela = indice >= 0 ? janelas[indice] : undefined;
  if (janela) {
    try {
      await janela.focus();
      if (!janela.navigate) throw new Error('sem_navigate');
      await janela.navigate(destino);
      return;
    } catch {
      // Janela sem controle do service worker não navega: cai para abrir uma nova.
    }
  }
  await escopo.clients.openWindow(destino);
}

/** Liga os dois handlers no escopo do service worker. */
export function registrarHandlersPush(escopo: EscopoPush): void {
  escopo.addEventListener('push', ((evento: EventoPush) => aoReceberPush(escopo, evento)) as (e: never) => void);
  escopo.addEventListener('notificationclick', ((evento: EventoCliqueNotificacao) =>
    aoClicarNotificacao(escopo, evento)) as (e: never) => void);
}
