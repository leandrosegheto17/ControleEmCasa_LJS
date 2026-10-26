import { createContext, useContext } from 'react';
import type { TipoAviso } from './Aviso';

export interface ControleAviso {
  mostrar: (tipo: TipoAviso, mensagem: string) => void;
}

export const ContextoAviso = createContext<ControleAviso | null>(null);

export function useAviso(): ControleAviso {
  const controle = useContext(ContextoAviso);
  if (!controle) throw new Error('useAviso exige estar dentro de <RegiaoAvisos>');
  return controle;
}
