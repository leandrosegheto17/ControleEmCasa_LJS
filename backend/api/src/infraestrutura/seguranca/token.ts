/**
 * Tokens opacos de 256 bits (sessão e links de e-mail; G-15, G-18). O banco guarda só o SHA-256 (32 bytes).
 * O token em claro só existe no cookie ou no link do e-mail: nunca em log, URL de API ou resposta JSON.
 */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function gerarToken(): string {
  return paraBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** SHA-256 do token, no formato de `token_hash` (bytea de 32 bytes). */
export async function hashToken(token: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
}

/** `true` só para o formato que a API gera (43 caracteres base64url = 32 bytes). */
export function tokenTemFormato(token: string): boolean {
  return FORMATO_TOKEN.test(token);
}

export function paraBase64Url(bytes: Uint8Array): string {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deBase64Url(texto: string): Uint8Array {
  const padrao = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(padrao + '='.repeat((4 - (padrao.length % 4)) % 4));
  return Uint8Array.from(binario, (ch) => ch.charCodeAt(0));
}
