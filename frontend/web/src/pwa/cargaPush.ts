/**
 * Lógica pura dos handlers de push do service worker (SDD 9.1; RN-27; G-36; ADR 014), separada de `sw.ts` para ser
 * testada. Não importa nada: roda no worker e nos testes. A carga é dado não confiável: só `titulo` e `corpo` viram
 * texto da notificação (nunca HTML) e só uma `url` do próprio app (`/app/...`) vale como destino do clique.
 */

export interface CargaPush {
  titulo: string;
  corpo: string;
  /** Destino do clique; `/app/` quando a carga não traz uma url válida. */
  url: string;
  /** Agrupa por tipo de aviso: um aviso novo do mesmo tipo substitui o anterior. */
  tag: string;
}

export const URL_PADRAO = '/app/';
const MAX_TITULO = 100;
const MAX_CORPO = 300;

/** Tipo do aviso, deduzido da tela de destino que o servidor manda (`fixas`, `lembrete`, `metas`). */
export function tagDoAviso(url: string): string {
  if (url === '/app/fixas' || url.startsWith('/app/fixas/') || url.startsWith('/app/fixas?')) return 'fixas';
  if (url === '/app/lancar' || url.startsWith('/app/lancar?')) return 'lembrete';
  if (url === '/app/metas' || url.startsWith('/app/metas/') || url.startsWith('/app/metas?')) return 'metas';
  return 'geral';
}

/**
 * Destino seguro do clique: só caminho que começa com `/app/` e que, resolvido contra a origem do app, continua nela
 * e continua sob `/app/`. Qualquer outra coisa (URL absoluta, `//`, `..`, `javascript:`) devolve `null`.
 */
export function urlDoClique(url: unknown, origem: string): string | null {
  if (typeof url !== 'string' || !url.startsWith('/app/') || url.includes('\\')) return null;
  let resolvida: URL;
  try {
    resolvida = new URL(url, origem);
  } catch {
    return null;
  }
  if (resolvida.origin !== origem || !resolvida.pathname.startsWith('/app/')) return null;
  return `${resolvida.pathname}${resolvida.search}${resolvida.hash}`;
}

/** Interpreta o texto da carga. `null` quando não é um JSON com `titulo` e `corpo` de texto: o aviso é ignorado. */
export function interpretarCarga(texto: string | null | undefined, origem: string): CargaPush | null {
  if (!texto) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null;
  const { titulo, corpo, url } = bruto as Record<string, unknown>;
  if (typeof titulo !== 'string' || typeof corpo !== 'string') return null;
  const t = titulo.trim().slice(0, MAX_TITULO);
  const c = corpo.trim().slice(0, MAX_CORPO);
  if (t === '') return null;
  const destino = urlDoClique(url, origem) ?? URL_PADRAO;
  return { titulo: t, corpo: c, url: destino, tag: tagDoAviso(destino) };
}

/** Índice da primeira janela do app (mesma origem, sob `/app`) entre as abertas; `-1` se não houver. */
export function escolherJanela(urls: readonly string[], origem: string): number {
  return urls.findIndex((u) => {
    try {
      const url = new URL(u);
      return url.origin === origem && (url.pathname === '/app' || url.pathname.startsWith('/app/'));
    } catch {
      return false;
    }
  });
}
