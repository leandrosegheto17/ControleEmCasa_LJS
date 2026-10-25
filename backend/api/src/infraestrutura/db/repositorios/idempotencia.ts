import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/** Namespace da trava consultiva por id do cliente (o do vínculo do usuário é 4201; ver `lares.ts`). */
const TRAVA_ESCRITA_POR_ID = 4202;

/**
 * Serializa as escritas concorrentes com o MESMO id do cliente até o fim da transação (ADR-010; CA-T3.3).
 * Sem isso, duas inserções simultâneas do mesmo id esbarram em índices únicos diferentes (a chave primária e
 * os `unique (id, …)` das FKs compostas) e uma delas falharia com 23505 em vez de enxergar a linha da outra.
 * Com a trava, a segunda espera a primeira confirmar e então lê a linha que ela gravou. Ids diferentes não
 * esperam um ao outro (salvo colisão do hash, que só serializa).
 */
export async function travarEscritaPorId(db: Kysely<DB>, id: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(${TRAVA_ESCRITA_POR_ID}, hashtext(${id}))`.execute(db);
}
