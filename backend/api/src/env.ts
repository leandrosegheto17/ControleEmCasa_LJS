import type { Kysely, Transaction } from 'kysely';
import type { DB } from './infraestrutura/db/tipos';

/** Bindings e variáveis do Worker (wrangler.jsonc, SDD 11). Segredos entram nas etapas que os usam. */
export interface Bindings {
  HYPERDRIVE: Hyperdrive;
  URL_PUBLICA: string;
  AMBIENTE: 'local' | 'teste' | 'producao';
  /** Remetente dos e-mails (`Nome <email>`; SDD 11.2). */
  MAIL_FROM?: string;
  /** Segredo (`wrangler secret`; no local, `.dev.vars`): 32 bytes base64url para o HMAC de e-mail e IP. */
  CHAVE_HMAC?: string;
  /** Segredo: chave do Resend (só envio). Em `local`, o transporte de console basta. */
  RESEND_API_KEY?: string;
  /** Sem o binding (local), não limita; em https, a ausência é registrada (SDD 11.2). */
  LIMITE_ENTRAR?: RateLimit;
  LIMITE_PUBLICO?: RateLimit;
  LIMITE_WEBHOOK?: RateLimit;
}

/** Identidade que a sessão entrega ao middleware de transação. O lar NUNCA vem daqui (G-03). */
export interface Sessao {
  usuarioId: string;
  email: string;
}

/**
 * Vínculo ativo do usuário (SDD 5.3; G-03): lido de `app.membro` na própria transação, no mesmo comando que
 * grava `app.lar_id`, `app.membro_id` e `app.papel`. Nulo quando o usuário ainda não tem lar.
 */
export interface Vinculo {
  larId: string;
  membroId: string;
  papel: 'titular' | 'membro';
}

export interface Variaveis {
  idRequisicao: string;
  db: Kysely<DB>;
  /** Instante único da requisição, lido do relógio injetável (SDD 2.2 `relogio/`). */
  agora: Date;
  sessao: Sessao | null;
  /** Transação aberta por `emTransacao`; só existe em rota autenticada. */
  tx: Transaction<DB>;
  /** Vínculo derivado no banco ao abrir a transação (nulo sem lar). */
  vinculo: Vinculo | null;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variaveis;
}
