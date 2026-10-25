import type { Kysely, Transaction } from 'kysely';
import type { DB } from './infraestrutura/db/tipos';

/** Bindings e variáveis do Worker (wrangler.jsonc, SDD 11). Segredos entram nas etapas que os usam. */
export interface Bindings {
  HYPERDRIVE: Hyperdrive;
  URL_PUBLICA: string;
  AMBIENTE: 'local' | 'teste' | 'producao';
  /** Sem o binding (local), não limita. Os middlewares que os usam entram na etapa 4. */
  LIMITE_ENTRAR?: RateLimit;
  LIMITE_PUBLICO?: RateLimit;
  LIMITE_WEBHOOK?: RateLimit;
}

/** Identidade que a sessão (etapa 4) entrega ao middleware de transação. */
export interface Sessao {
  usuarioId: string;
  email: string;
  /**
   * SPEC_DEVIATION: o SDD 5.3 manda derivar o lar de `app.membro` na própria instrução do GUC. A tabela
   * `membro` só nasce na etapa 6; até lá o chamador informa o lar (ou null). A etapa 6 troca isto pela derivação.
   */
  larId: string | null;
}

export interface Variaveis {
  idRequisicao: string;
  db: Kysely<DB>;
  sessao: Sessao | null;
  /** Transação aberta por `emTransacao`; só existe em rota autenticada. */
  tx: Transaction<DB>;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variaveis;
}
