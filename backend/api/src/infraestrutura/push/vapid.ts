import { deBase64Url, paraBase64Url, texto } from './base64url';
import type { ChaveCripto, ConfigVapid, ParDeChaves } from './tipos';

/**
 * VAPID (RFC 8292): JWT ES256 assinado com `crypto.subtle`, sem SDK.
 * `aud` = origem do endpoint; `exp` = agora + 12 h (o RFC permite até 24 h); `sub` = contato do operador.
 */

/** Validade do JWT (o teto do RFC 8292 é 24 h; aqui, 12 h). */
export const VALIDADE_JWT_SEGUNDOS = 12 * 60 * 60;

const P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;

/** Ponto P-256 não comprimido (0x04 || x || y) em base64url → `{x, y}` da JWK. */
function coordenadas(chavePublica: string): { x: string; y: string } {
  const bytes = deBase64Url(chavePublica);
  if (bytes.length !== 65 || bytes[0] !== 0x04) throw new TypeError('chave_publica_invalida');
  return { x: paraBase64Url(bytes.subarray(1, 33)), y: paraBase64Url(bytes.subarray(33, 65)) };
}

/** A configuração tem o formato certo? (não confere se o par combina; isso só a assinatura prova). */
export function configVapidValida(vapid: ConfigVapid): boolean {
  try {
    coordenadas(vapid.chavePublica);
    if (deBase64Url(vapid.chavePrivada).length !== 32) return false;
  } catch {
    return false;
  }
  return /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(vapid.assunto);
}

/** Chave pública VAPID que o navegador usa em `pushManager.subscribe` (`applicationServerKey`). */
export function chavePublica(vapid: ConfigVapid): string {
  if (!configVapidValida(vapid)) throw new TypeError('vapid_invalido');
  return vapid.chavePublica;
}

/** A chave privada importada para assinar (nunca extraível). */
export async function importarChaveDeAssinatura(vapid: ConfigVapid): Promise<ChaveCripto> {
  const { x, y } = coordenadas(vapid.chavePublica);
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: vapid.chavePrivada, x, y, ext: false },
    P256,
    false,
    ['sign'],
  );
}

/** JWT VAPID para o serviço de push do endpoint. */
export async function jwtVapid(endpoint: string, vapid: ConfigVapid, agora: Date): Promise<string> {
  const aud = new URL(endpoint).origin;
  const cabecalho = paraBase64Url(texto(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = Math.floor(agora.getTime() / 1000) + VALIDADE_JWT_SEGUNDOS;
  const corpo = paraBase64Url(texto(JSON.stringify({ aud, exp, sub: vapid.assunto })));
  const chave = await importarChaveDeAssinatura(vapid);
  // A WebCrypto devolve a assinatura ECDSA já no formato do JWS (r || s, 64 bytes), não em DER.
  const assinatura = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    chave,
    texto(`${cabecalho}.${corpo}`),
  );
  return `${cabecalho}.${corpo}.${paraBase64Url(new Uint8Array(assinatura))}`;
}

/** Cabeçalho `Authorization` do esquema `vapid` (RFC 8292 §3). */
export function autorizacaoVapid(jwt: string, vapid: ConfigVapid): string {
  return `vapid t=${jwt}, k=${vapid.chavePublica}`;
}

/** Gera um par VAPID novo (script `gerar-vapid`): só imprime; nunca grava em arquivo versionado. */
export async function gerarParVapid(): Promise<{ chavePublica: string; chavePrivada: string }> {
  const par = (await crypto.subtle.generateKey(P256, true, ['sign', 'verify'])) as ParDeChaves;
  const publica = new Uint8Array((await crypto.subtle.exportKey('raw', par.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey('jwk', par.privateKey)) as { d?: string };
  if (!jwk.d) throw new Error('chave_sem_d');
  return { chavePublica: paraBase64Url(publica), chavePrivada: jwk.d };
}
