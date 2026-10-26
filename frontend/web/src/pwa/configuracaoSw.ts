/**
 * Regras de roteamento do service worker, separadas de `sw.ts` para serem testadas (G-39, SDD 9.1).
 * Este arquivo não importa nada: roda no worker e nos testes.
 */

/** Tudo em `/api/*` vai direto à rede: o service worker nunca guarda resposta da API (G-39). */
export const PADRAO_API = /^\/api(\/|$)/;

/** Navegações atendidas com o `index.html` do precache: só o app (`/app/*`), nunca a API (SDD 9.1). */
export const NAVEGACAO_PERMITIDA = [/^\/app(\/|$)/];
export const NAVEGACAO_NEGADA = [PADRAO_API];

export function ehChamadaApi(caminho: string): boolean {
  return PADRAO_API.test(caminho);
}

export function ehNavegacaoDoApp(caminho: string): boolean {
  return NAVEGACAO_PERMITIDA.some((p) => p.test(caminho)) && !NAVEGACAO_NEGADA.some((p) => p.test(caminho));
}
