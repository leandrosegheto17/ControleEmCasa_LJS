import { useEffect } from 'react';
import { useMatches } from 'react-router';
import { montarTitulo } from '../formatacao/titulo';

export interface HandleRota {
  titulo: string;
  comMes?: boolean;
  estreito?: boolean;
}

/** Handle da rota mais interna que o declara. */
export function useHandleDaRota(): HandleRota | undefined {
  const handles = useMatches().flatMap((m) => (m.handle ? [m.handle as HandleRota] : []));
  return handles.at(-1);
}

/** Define `document.title` pelo handle da rota; o mês só entra em rota `comMes`. */
export function useTituloDaPagina(mes?: string | null): void {
  const handle = useHandleDaRota();
  useEffect(() => {
    if (handle) document.title = montarTitulo(handle.titulo, handle.comMes ? mes : null);
  }, [handle, mes]);
}
