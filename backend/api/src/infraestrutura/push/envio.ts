import { texto } from './base64url';
import { cifrarAes128gcm } from './cifra';
import type { AssinaturaPush, CargaPush, ConfigVapid, OpcoesEnvio, ResultadoPush } from './tipos';
import { autorizacaoVapid, jwtVapid } from './vapid';

/** TTL padrão: 12 h (um aviso do dia não serve no dia seguinte). */
export const TTL_PADRAO_SEGUNDOS = 12 * 60 * 60;
const TIMEOUT_PADRAO_MS = 10_000;
const TOPICO = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * Envia uma mensagem a um aparelho (RFC 8030 + RFC 8291 + RFC 8292). Nunca lança e nunca registra nada: quem chama
 * decide o log, sem o endpoint nem as chaves (G-46; A-04).
 * - 2xx → `ok`;
 * - 404 ou 410 → `expirada` (a inscrição não existe mais: remover);
 * - qualquer outro status, erro de rede, tempo esgotado, endpoint não https ou chaves inválidas → `falha`.
 */
export async function enviarPush(
  assinatura: AssinaturaPush,
  carga: CargaPush,
  vapid: ConfigVapid,
  opcoes: OpcoesEnvio = {},
): Promise<ResultadoPush> {
  try {
    const url = new URL(assinatura.endpoint);
    if (url.protocol !== 'https:') return 'falha';
    const jwt = await jwtVapid(assinatura.endpoint, vapid, opcoes.agora ?? new Date());
    const corpo = await cifrarAes128gcm(texto(JSON.stringify(carga)), assinatura.p256dh, assinatura.auth);
    const cabecalhos: Record<string, string> = {
      Authorization: autorizacaoVapid(jwt, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(Math.max(0, Math.floor(opcoes.ttlSegundos ?? TTL_PADRAO_SEGUNDOS))),
      Urgency: opcoes.urgencia ?? 'normal',
    };
    if (opcoes.topico && TOPICO.test(opcoes.topico)) cabecalhos['Topic'] = opcoes.topico;
    const resposta = await (opcoes.fetch ?? fetch)(assinatura.endpoint, {
      method: 'POST',
      headers: cabecalhos,
      body: corpo,
      signal: AbortSignal.timeout(opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS),
    });
    // O corpo da resposta não interessa; descartado para liberar a conexão.
    await resposta.body?.cancel().catch(() => undefined);
    if (resposta.status >= 200 && resposta.status < 300) return 'ok';
    if (resposta.status === 404 || resposta.status === 410) return 'expirada';
    return 'falha';
  } catch {
    return 'falha';
  }
}
