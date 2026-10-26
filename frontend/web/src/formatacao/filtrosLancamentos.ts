import { paraEscopoApi } from './escopoUrl';

/** Filtros da lista no vocabulário da consulta (`individual`/`conjunto`). */
export type FiltrosDaLista = {
  escopo?: 'individual' | 'conjunto';
  categoriaId?: string;
  formaId?: string;
  variavel?: true;
};

/** Filtros da lista como vivem na URL (`?escopo=casa&categoria=…&forma=…&variavel=1`). */
export type FiltrosUrl = {
  escopo?: 'eu' | 'casa';
  categoria?: string;
  forma?: string;
  variavel?: true;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gravamos `1`; `true` é aceito na leitura por ser como o link de outras telas e o mockup escrevem. */
const VARIAVEL_LIGADO = new Set(['1', 'true']);

const uuidOuNada = (valor: string | null): string | undefined =>
  valor !== null && UUID.test(valor) ? valor : undefined;

/** Lê os filtros; o que a URL traz fora do formato é ignorado (a URL é entrada não confiável). */
export function lerFiltrosDaUrl(params: URLSearchParams): FiltrosUrl {
  const escopo = params.get('escopo');
  const categoria = uuidOuNada(params.get('categoria'));
  const forma = uuidOuNada(params.get('forma'));
  return {
    ...(escopo === 'eu' || escopo === 'casa' ? { escopo } : {}),
    ...(categoria !== undefined && { categoria }),
    ...(forma !== undefined && { forma }),
    ...(VARIAVEL_LIGADO.has(params.get('variavel') ?? '') && { variavel: true as const }),
  };
}

/** Cópia dos parâmetros com os filtros trocados (os ausentes saem da URL), preservando `mes` e o resto. */
export function escreverFiltrosNaUrl(params: URLSearchParams, filtros: FiltrosUrl): URLSearchParams {
  const copia = new URLSearchParams(params);
  for (const nome of ['escopo', 'categoria', 'forma', 'variavel']) copia.delete(nome);
  if (filtros.escopo !== undefined) copia.set('escopo', filtros.escopo);
  if (filtros.categoria !== undefined) copia.set('categoria', filtros.categoria);
  if (filtros.forma !== undefined) copia.set('forma', filtros.forma);
  if (filtros.variavel) copia.set('variavel', '1');
  return copia;
}

export const haFiltroAtivo = (filtros: FiltrosUrl): boolean => Object.keys(filtros).length > 0;

/** Vocabulário da URL → o da consulta (`eu` é `individual`, `casa` é `conjunto`). */
export function paraFiltrosApi(filtros: FiltrosUrl): FiltrosDaLista {
  return {
    ...(filtros.escopo !== undefined && { escopo: paraEscopoApi(filtros.escopo) }),
    ...(filtros.categoria !== undefined && { categoriaId: filtros.categoria }),
    ...(filtros.forma !== undefined && { formaId: filtros.forma }),
    ...(filtros.variavel && { variavel: true as const }),
  };
}

/** Explicação do vazio filtrado; só a combinação casa + forma tem frase própria, as demais usam a genérica. */
export function textoVazioFiltrado(filtros: FiltrosUrl, nomeMes: string, nomeForma: string | undefined): string {
  const soCasaEForma =
    filtros.escopo === 'casa' && filtros.forma !== undefined && !filtros.categoria && !filtros.variavel;
  return soCasaEForma && nomeForma !== undefined
    ? `Em ${nomeMes}, você não pagou despesas da casa com o ${nomeForma}.`
    : `Nenhum lançamento em ${nomeMes} com esses filtros.`;
}
