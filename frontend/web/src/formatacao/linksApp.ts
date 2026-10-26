import * as base from './links';

/**
 * Os links do app moram sob `/app` (SDD 9.3). `links.ts` guarda os caminhos relativos à raiz do app (como no legado);
 * aqui cada um ganha o prefixo, para quem monta um `<Link>` ou um `navigate`.
 */
export const PREFIXO_APP = '/app';

/** `/lancamentos?mes=…` vira `/app/lancamentos?mes=…`; a raiz (`/`) vira `/app`. */
export function noApp(caminho: string): string {
  if (caminho === '/') return PREFIXO_APP;
  return caminho.startsWith('/?') ? `${PREFIXO_APP}${caminho.slice(1)}` : `${PREFIXO_APP}${caminho}`;
}

type Argumentos<F> = F extends (...args: infer A) => string ? A : never;
const com =
  <F extends (...args: never[]) => string>(f: F) =>
  (...args: Argumentos<F>): string =>
    noApp(f(...(args as never[])));

export const linkLancamentos = com(base.linkLancamentos);
export const linkOrcamento = com(base.linkOrcamento);
export const linkFixas = com(base.linkFixas);
export const linkEnvios = com(base.linkEnvios);
export const linkMeta = com(base.linkMeta);
export const linkConta = com(base.linkConta);
export const linkForma = com(base.linkForma);

/** Lista de metas e o formulário de meta (SDD 9.3): `/app/metas`, `/app/metas/nova`, `/app/metas/:id/editar`. */
export const LINK_METAS = noApp('/metas');
export const linkMetaNova = (escopo?: 'casa' | 'eu') =>
  escopo === undefined ? noApp('/metas/nova') : noApp(`/metas/nova?escopo=${escopo}`);
export const linkMetaEditar = (id: string) => noApp(`/metas/${id}/editar`);
/** Meu plano (SDD 9.3): destino dos links dos e-mails de cobrança. */
export const LINK_PLANO = noApp('/ajustes/plano');
/** Membros e convite do lar (SDD 9.3). */
export const LINK_LAR = noApp('/ajustes/lar');
