/** base64url sem preenchimento (RFC 4648 §5), como o Web Push e o JWT usam. Sem dependência: só `atob`/`btoa`. */

export function paraBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Lança `TypeError` se o texto não for base64url válido. */
export function deBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) throw new TypeError('base64url_invalido');
  const padrao = texto.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (texto.length % 4)) % 4);
  const binario = atob(padrao);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function juntar(...partes: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

export const texto = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(new TextEncoder().encode(s));
