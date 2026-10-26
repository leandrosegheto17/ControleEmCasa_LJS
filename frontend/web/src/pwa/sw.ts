/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { NAVEGACAO_NEGADA, NAVEGACAO_PERMITIDA, ehChamadaApi } from './configuracaoSw';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

// Service worker do app (injectManifest). Os handlers de push e notificationclick entram na etapa 15.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// G-39: a API só passa pela rede; nenhuma resposta de /api vai para o Cache Storage.
registerRoute(({ url }) => ehChamadaApi(url.pathname), new NetworkOnly());

// Abrir /app/... sem rede serve o index.html do precache (o roteamento é do React Router).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    allowlist: NAVEGACAO_PERMITIDA,
    denylist: NAVEGACAO_NEGADA,
  }),
);

// registerType "autoUpdate": a versão nova instala, assume e atualiza as abas abertas.
void self.skipWaiting();
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));
