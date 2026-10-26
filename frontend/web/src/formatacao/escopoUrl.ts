import type { Escopo } from '../comum/enums';

/** Escopo como vive na URL (`?escopo=casa|eu`); a API fala `conjunto|individual`. */
export type EscopoUrl = 'casa' | 'eu';

const PARA_API: Record<EscopoUrl, Escopo> = { casa: 'conjunto', eu: 'individual' };
const PARA_URL: Record<Escopo, EscopoUrl> = { conjunto: 'casa', individual: 'eu' };

/** Lê `?escopo=`; ausente ou fora da lista fechada vale `casa` (a URL é entrada não confiável). */
export function lerEscopoDaUrl(params: URLSearchParams): EscopoUrl {
  const valor = params.get('escopo');
  return valor === 'eu' ? 'eu' : 'casa';
}

export const paraEscopoApi = (escopo: EscopoUrl): Escopo => PARA_API[escopo];

export const paraEscopoUrl = (escopo: Escopo): EscopoUrl => PARA_URL[escopo];
