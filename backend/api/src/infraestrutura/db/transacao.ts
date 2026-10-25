import { sql, type Kysely, type Transaction } from 'kysely';
import type { Sessao } from '../../env';
import type { DB } from './tipos';

/**
 * Abre a transação da requisição e grava a identidade como GUC LOCAL (G-02, ADR 005):
 * `set_config(..., true)` some no COMMIT e no ROLLBACK, então a conexão volta ao pool do Hyperdrive sem identidade.
 * É o PRIMEIRO comando da transação. GUC vazio ('') nega o acesso nas políticas (`app.usuario_atual()` vira NULL).
 * Proibido (G-02): GUC global (is_local falso), SET fora de LOCAL e consulta de negócio fora desta transação;
 * a varredura de código dos testes recusa esses padrões.
 */
export async function emTransacaoComo<T>(
  db: Kysely<DB>,
  sessao: Sessao,
  fn: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.usuario_id', ${sessao.usuarioId}, true),
                     set_config('app.email', ${sessao.email}, true),
                     set_config('app.lar_id', ${sessao.larId ?? ''}, true)`.execute(trx);
    return fn(trx);
  });
}
