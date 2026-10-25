import { deBase64Url } from './token';

/**
 * HMAC-SHA-256 com `CHAVE_HMAC` (SDD 3.3 `tentativa_login`): o e-mail e o IP das tentativas de login
 * nunca são guardados em claro. O prefixo separa os domínios (um e-mail nunca colide com um IP).
 */
export type ChaveHmac = CryptoKey;

export async function importarChaveHmac(base64url: string): Promise<ChaveHmac> {
  return crypto.subtle.importKey('raw', deBase64Url(base64url), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function hmac(chave: ChaveHmac, texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto)));
}

/** O e-mail já chega normalizado pelo contrato (trim e minúsculas). */
export function hashEmail(chave: ChaveHmac, emailNormalizado: string): Promise<Uint8Array> {
  return hmac(chave, `email:${emailNormalizado}`);
}

export function hashIp(chave: ChaveHmac, ip: string): Promise<Uint8Array> {
  return hmac(chave, `ip:${ip}`);
}
