import { createContext, useContext, type ReactNode } from 'react';

interface ValorInstalar {
  /** O app já roda instalado (modo standalone ou `appinstalled`). */
  instalado: boolean;
  /** Pede a instalação: prompt nativo quando existe, senão a folha com os passos. */
  instalar: () => void;
  /** Faixa de convite para a T02; nula fora do celular, instalado ou dispensada. */
  faixa: ReactNode;
}

export const ContextoInstalar = createContext<ValorInstalar>({ instalado: true, instalar: () => {}, faixa: null });

export function useInstalar(): ValorInstalar {
  return useContext(ContextoInstalar);
}
