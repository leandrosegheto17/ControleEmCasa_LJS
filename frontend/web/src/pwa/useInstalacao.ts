import { useSyncExternalStore } from 'react';
import { assinar, obter, type EstadoInstalacao } from './instalacao';

export function useInstalacao(): EstadoInstalacao {
  return useSyncExternalStore(assinar, obter, obter);
}
