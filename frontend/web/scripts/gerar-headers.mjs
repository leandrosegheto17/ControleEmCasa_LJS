// Gera `dist/_headers` a partir de `public/_headers`, acrescentando o host de ingestão do Sentry
// (de VITE_SENTRY_DSN) ao connect-src da CSP do app (G-35; exceção registrada no GUARDRAILS).
// DSN ausente ou inválido: o arquivo sai idêntico ao original (DSN inválido gera aviso).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOST_VALIDO = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?$/i;
const ORIGEM = "connect-src 'self'";

/** Devolve `{ host }` com o host validado do DSN, `{ host: null }` sem DSN, ou `{ host: null, aviso }`. */
export function hostDoDsn(dsn) {
  if (dsn === undefined || dsn.trim() === '') return { host: null };
  const recusa = (motivo) => ({
    host: null,
    aviso: `VITE_SENTRY_DSN ignorado (${motivo}); a CSP fica sem o host do Sentry.`,
  });
  // `new URL` descarta tab e quebra de linha em silêncio: o DSN cru não pode ter espaço nem controle.
  if ([...dsn].some((c) => /\s/.test(c) || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
    return recusa('espaço ou caractere de controle');
  let url;
  try {
    url = new URL(dsn);
  } catch {
    return recusa('não é uma URL');
  }
  if (url.protocol !== 'https:') return recusa('só https é aceito');
  // `new URL('https://x@a.com;script-src/1').host` devolve `a.com;script-src`: o regex barra o que sobra.
  if (!HOST_VALIDO.test(url.host)) return recusa('host inválido');
  return { host: url.host };
}

/** Acrescenta o host ao connect-src. Sem host válido devolve o conteúdo original, byte a byte. */
export function gerarHeaders(original, dsn) {
  const { host, aviso } = hostDoDsn(dsn);
  if (host === null) return { conteudo: original, aviso };
  return { conteudo: original.replace(ORIGEM, `${ORIGEM} https://${host.toLowerCase()}`), aviso };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // HEADERS_ORIGEM e HEADERS_DESTINO (opcionais) trocam os caminhos padrão; usados pelo teste da linha de comando.
  const origem = process.env.HEADERS_ORIGEM ?? new URL('../public/_headers', import.meta.url);
  const destino = process.env.HEADERS_DESTINO ?? new URL('../dist/_headers', import.meta.url);
  const { conteudo, aviso } = gerarHeaders(readFileSync(origem, 'utf8'), process.env.VITE_SENTRY_DSN);
  if (aviso) console.warn(`[gerar-headers] ${aviso}`);
  writeFileSync(destino, conteudo);
}
