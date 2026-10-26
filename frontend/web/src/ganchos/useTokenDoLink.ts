import { useEffect, useState } from 'react';

const CHAVE_CONVITE = 'controle.convite-em-espera';

/** Token do fragmento (`#t=`) do endereço atual, sem alterá-lo. */
export function lerTokenDoFragmento(): string | undefined {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('t');
  return token ? token : undefined;
}

/** Tira o fragmento do endereço sem recarregar nem criar entrada no histórico (G-18). */
export function apagarFragmento(): void {
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
}

/**
 * Token de um link de e-mail: lido na primeira renderização e apagado do endereço no efeito (o StrictMode renderiza
 * duas vezes). Nunca fica no endereço nem vai para log.
 */
export function useTokenDoLink(): string | undefined {
  const [token] = useState(lerTokenDoFragmento);
  useEffect(apagarFragmento, []);
  return token;
}

/**
 * O convite precisa sobreviver a "entrar ou cadastrar e voltar": o token fica só na sessionStorage da aba, até o
 * aceite, a recusa ou um convite inválido, e nunca no endereço.
 */
export function useTokenDoConvite(): { token: string | undefined; esquecer: () => void } {
  const [token, setToken] = useState<string | undefined>(() => {
    const doLink = lerTokenDoFragmento();
    try {
      if (doLink) window.sessionStorage.setItem(CHAVE_CONVITE, doLink);
      return doLink ?? window.sessionStorage.getItem(CHAVE_CONVITE) ?? undefined;
    } catch {
      return doLink;
    }
  });
  useEffect(apagarFragmento, []);
  return {
    token,
    esquecer: () => {
      try {
        window.sessionStorage.removeItem(CHAVE_CONVITE);
      } catch {
        // sem armazenamento: nada a apagar
      }
      setToken(undefined);
    },
  };
}
