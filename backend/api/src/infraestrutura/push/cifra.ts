import { deBase64Url, juntar, paraBase64Url, texto } from './base64url';
import type { AlgoritmoDerivacao, ParDeChaves } from './tipos';

/**
 * Criptografia da mensagem do Web Push (RFC 8291) no formato `aes128gcm` (RFC 8188), só com `crypto.subtle`.
 *
 *   ecdh_secret = ECDH(as_private, ua_public)
 *   IKM   = HKDF(salt = auth_secret, ikm = ecdh_secret, info = "WebPush: info" 0x00 ua_public as_public, 32)
 *   CEK   = HKDF(salt, IKM, "Content-Encoding: aes128gcm" 0x00, 16)
 *   NONCE = HKDF(salt, IKM, "Content-Encoding: nonce" 0x00, 12)
 *   corpo = salt(16) || rs(4, 4096) || idlen(1, 65) || as_public(65) || AES-128-GCM(CEK, NONCE, texto || 0x02)
 *
 * Um único registro (a mensagem cabe nele), com o delimitador 0x02 de último registro e sem preenchimento extra.
 */

/** Tamanho do registro declarado no cabeçalho (RFC 8188). */
export const TAMANHO_REGISTRO = 4096;
/** Cabeçalho (86 bytes) + delimitador (1) + tag do GCM (16): o resto do registro é o máximo da mensagem. */
export const MAX_MENSAGEM_BYTES = TAMANHO_REGISTRO - 86 - 1 - 16;

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;

/** Chave efêmera do servidor e sal: aleatórios em produção; fixos só nos testes com os vetores do RFC 8291. */
export interface MaterialFixo {
  /** `d` da chave privada efêmera (32 bytes), base64url. */
  privadaEfemera: string;
  /** Ponto público efêmero não comprimido (65 bytes), base64url. */
  publicaEfemera: string;
  /** Sal de 16 bytes, base64url. */
  sal: string;
}

async function hkdf(
  ikm: Uint8Array<ArrayBuffer>,
  sal: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  bytes: number,
) {
  const chave = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, chave, bytes * 8);
  return new Uint8Array(bits);
}

async function materialEfemero(fixo?: MaterialFixo) {
  if (fixo) {
    const publica = deBase64Url(fixo.publicaEfemera);
    const privada = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: fixo.privadaEfemera,
        x: paraBase64Url(publica.subarray(1, 33)),
        y: paraBase64Url(publica.subarray(33, 65)),
        ext: false,
      },
      ECDH,
      false,
      ['deriveBits'],
    );
    return { privada, publica, sal: deBase64Url(fixo.sal) };
  }
  const par = (await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])) as ParDeChaves;
  const publica = new Uint8Array((await crypto.subtle.exportKey('raw', par.publicKey)) as ArrayBuffer);
  return { privada: par.privateKey, publica, sal: crypto.getRandomValues(new Uint8Array(16)) };
}

/**
 * Cifra `mensagem` para o navegador dono de `p256dh`/`auth`. Lança se as chaves do navegador forem inválidas ou se a
 * mensagem não couber num registro.
 */
export async function cifrarAes128gcm(
  mensagem: Uint8Array<ArrayBuffer>,
  p256dh: string,
  auth: string,
  fixo?: MaterialFixo,
): Promise<Uint8Array<ArrayBuffer>> {
  if (mensagem.length > MAX_MENSAGEM_BYTES) throw new RangeError('mensagem_grande');
  const uaPublica = deBase64Url(p256dh);
  const segredo = deBase64Url(auth);
  if (uaPublica.length !== 65 || uaPublica[0] !== 0x04 || segredo.length !== 16) {
    throw new TypeError('chaves_do_navegador_invalidas');
  }
  const ua = await crypto.subtle.importKey('raw', uaPublica, ECDH, false, []);
  const { privada, publica, sal } = await materialEfemero(fixo);
  // O parâmetro do runtime chama-se `public` (Web Crypto); os tipos do Workers o declaram como `$public`.
  const algoritmo = { name: 'ECDH', public: ua } as unknown as AlgoritmoDerivacao;
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits(algoritmo, privada, 256));

  const ikm = await hkdf(ecdh, segredo, juntar(texto('WebPush: info\0'), uaPublica, publica), 32);
  const cek = await hkdf(ikm, sal, texto('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, sal, texto('Content-Encoding: nonce\0'), 12);

  const chave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      chave,
      juntar(mensagem, new Uint8Array([0x02])),
    ),
  );

  const cabecalho = new Uint8Array(16 + 4 + 1 + 65);
  cabecalho.set(sal, 0);
  new DataView(cabecalho.buffer).setUint32(16, TAMANHO_REGISTRO);
  cabecalho[20] = 65;
  cabecalho.set(publica, 21);
  return juntar(cabecalho, cifrado);
}
