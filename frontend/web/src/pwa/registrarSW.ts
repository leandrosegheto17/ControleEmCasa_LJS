import { registerSW } from 'virtual:pwa-register';

/** Registra o service worker (atualização automática no próximo carregamento). */
export function registrarSW(): void {
  registerSW({ immediate: true });
}
