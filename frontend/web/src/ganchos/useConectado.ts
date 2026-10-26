import { useSyncExternalStore } from 'react';

function assinar(aoMudar: () => void): () => void {
  window.addEventListener('online', aoMudar);
  window.addEventListener('offline', aoMudar);
  return () => {
    window.removeEventListener('online', aoMudar);
    window.removeEventListener('offline', aoMudar);
  };
}

/** `false` quando o navegador diz que está sem rede; o servidor fora do ar não passa por aqui. */
export function useConectado(): boolean {
  return useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true,
  );
}
