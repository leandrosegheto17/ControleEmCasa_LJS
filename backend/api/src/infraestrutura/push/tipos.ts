/** Tipos do módulo de push (interface pequena do SDD 2.2: `enviarPush`, `chavePublica`). */

/** Inscrição do navegador (`PushSubscription`): endpoint e chaves em base64url. */
export interface AssinaturaPush {
  endpoint: string;
  /** Chave pública ECDH P-256 do navegador, ponto não comprimido (65 bytes). */
  p256dh: string;
  /** Segredo de autenticação do navegador (16 bytes). */
  auth: string;
}

/** Par VAPID do servidor (RFC 8292) e o contato (`sub` do JWT). */
export interface ConfigVapid {
  /** Ponto P-256 não comprimido (65 bytes), base64url. */
  chavePublica: string;
  /** Escalar `d` da chave privada P-256 (32 bytes), base64url. */
  chavePrivada: string;
  /** `mailto:` (ou `https:`) de contato do operador. */
  assunto: string;
}

/** Carga entregue ao service worker: título, texto curto e caminho relativo do app (RN-27; G-36: só texto fixo). */
export interface CargaPush {
  titulo: string;
  corpo: string;
  url: string;
}

/** `ok`: aceito pelo serviço (2xx). `expirada`: 404/410, a inscrição não existe mais. `falha`: o resto. */
export type ResultadoPush = 'ok' | 'expirada' | 'falha';

export type Urgencia = 'very-low' | 'low' | 'normal' | 'high';

export interface OpcoesEnvio {
  /** Quanto tempo o serviço guarda a mensagem se o aparelho estiver desligado (cabeçalho `TTL`). Padrão: 12 h. */
  ttlSegundos?: number;
  /** Cabeçalho `Urgency` (RFC 8030 §5.3). Padrão: `normal`. */
  urgencia?: Urgencia;
  /** Cabeçalho `Topic` (RFC 8030 §5.4): a mensagem nova do mesmo tópico substitui a pendente. Até 32 base64url. */
  topico?: string;
  /** Instante do JWT (testes). */
  agora?: Date;
  /** `fetch` injetado (testes). */
  fetch?: typeof fetch;
  /** Tempo máximo da requisição ao serviço de push. Padrão: 10 s. */
  timeoutMs?: number;
}

/**
 * Tipos da Web Crypto derivados do próprio `crypto.subtle`, sem citar os nomes globais (`CryptoKey`, `CryptoKeyPair`):
 * o módulo compila igual com os tipos do Workers (API) e do Node (script `gerar-vapid`).
 */
export type ChaveCripto = Awaited<ReturnType<typeof crypto.subtle.importKey>>;
export interface ParDeChaves {
  publicKey: ChaveCripto;
  privateKey: ChaveCripto;
}
export type AlgoritmoDerivacao = Parameters<typeof crypto.subtle.deriveBits>[0];
