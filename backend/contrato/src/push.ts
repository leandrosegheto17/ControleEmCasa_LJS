import { z } from 'zod';

/**
 * Contrato do Web Push (SDD 6.2 "Push"; RN-27; CA-27.1 a CA-27.8; TM-PUSH-04; ADR-014).
 * - `GET /api/push/chave` → `saida.ChavePush` (a chave pública VAPID que o navegador usa em `subscribe`).
 * - `POST /api/push/assinaturas` → `entrada.AssinaturaPush` (o `PushSubscription.toJSON()` do navegador, sem
 *   `expirationTime`) → 204.
 * - `DELETE /api/push/assinaturas` → `entrada.RemoverAssinaturaPush` → 204.
 * - `GET`/`PUT /api/notificacoes/preferencias` → `saida.Preferencias` / `entrada.Preferencias` → 204.
 */

/** Teto do endpoint (SDD 3.6). */
export const ENDPOINT_PUSH_MAX = 1024;
/** Máximo de aparelhos inscritos por usuário: a inscrição além disso tira a mais antiga. */
export const MAX_ASSINATURAS_PUSH = 10;
/** Hora padrão do lembrete diário, em São Paulo (RN-27). */
export const LEMBRETE_HORA_PADRAO = 20;

/**
 * Serviços de push aceitos (o Worker faz POST no endpoint: só estes hosts, para não virar proxy de requisição).
 * FCM (Chrome, Edge no Android, Opera), Mozilla (Firefox), Apple (Safari e PWA no iOS) e WNS (Edge no Windows).
 */
const HOSTS_EXATOS = new Set(['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com']);
const SUFIXOS = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];

/** O endpoint é `https:` (porta padrão, sem usuário/senha) de um serviço de push conhecido? */
export function endpointPushPermitido(endpoint: string): boolean {
  if (endpoint.length > ENDPOINT_PUSH_MAX) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return false;
  const host = url.hostname.toLowerCase();
  return HOSTS_EXATOS.has(host) || SUFIXOS.some((s) => host.endsWith(s) && host.length > s.length);
}

const Endpoint = z
  .string()
  .max(ENDPOINT_PUSH_MAX)
  .refine((e) => e.startsWith('https://') && endpointPushPermitido(e));
/** Ponto P-256 não comprimido (65 bytes) em base64url sem preenchimento. */
const ChaveP256dh = z.string().regex(/^[A-Za-z0-9_-]{87}$/);
/** Segredo de autenticação do navegador (16 bytes) em base64url sem preenchimento. */
const SegredoAuth = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

export const entradaPush = {
  AssinaturaPush: z
    .object({
      endpoint: Endpoint,
      keys: z.object({ p256dh: ChaveP256dh, auth: SegredoAuth }).strict(),
    })
    .strict(),
  RemoverAssinaturaPush: z.object({ endpoint: z.string().min(1).max(ENDPOINT_PUSH_MAX) }).strict(),
  Preferencias: z
    .object({
      fixas: z.boolean(),
      lembrete_diario: z.boolean(),
      lembrete_hora: z.number().int().min(0).max(23),
      metas: z.boolean(),
    })
    .strict(),
} as const;

export const saidaPush = {
  ChavePush: z.object({ chave_publica: z.string().regex(/^[A-Za-z0-9_-]{87}$/) }).strict(),
  Preferencias: entradaPush.Preferencias,
} as const;

/** Preferências de quem nunca salvou (RN-27): fixas e metas ligadas; lembrete desligado, às 20h. */
export const PREFERENCIAS_PADRAO = {
  fixas: true,
  lembrete_diario: false,
  lembrete_hora: LEMBRETE_HORA_PADRAO,
  metas: true,
} as const satisfies z.infer<typeof entradaPush.Preferencias>;

export type EntradaAssinaturaPush = z.infer<typeof entradaPush.AssinaturaPush>;
export type EntradaRemoverAssinaturaPush = z.infer<typeof entradaPush.RemoverAssinaturaPush>;
export type Preferencias = z.infer<typeof entradaPush.Preferencias>;
export type SaidaChavePush = z.infer<typeof saidaPush.ChavePush>;

/**
 * Códigos de erro das rotas de push (SDD 7). Nenhum é novo: corpo inválido (endpoint fora da lista, chave malformada)
 * é `valor_invalido`; sem lar, `sem_lar`; push sem configuração no servidor, `indisponivel`.
 */
export const CODIGOS_ERRO_PUSH = ['valor_invalido', 'sem_lar', 'sessao_expirada', 'indisponivel'] as const;
export type CodigoErroPush = (typeof CODIGOS_ERRO_PUSH)[number];
