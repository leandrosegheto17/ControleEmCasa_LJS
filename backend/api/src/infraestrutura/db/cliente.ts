import { Kysely, PostgresDialect, WithSchemaPlugin } from 'kysely';
import pg from 'pg';
import type { DB } from './tipos';

/**
 * Cliente Kysely + `pg` de UMA requisição (SDD 5.1, passo 5). No Workers, conexão não atravessa requisições,
 * então cada requisição cria o seu pool de 1 conexão e o fecha no fim. O pool de verdade é o do Hyperdrive.
 */
export function criarDb(stringDeConexao: string): Kysely<DB> {
  const pool = new pg.Pool({ connectionString: stringDeConexao, max: 1, connectionTimeoutMillis: 8000 });
  // Erro de soquete depois de fechar a conexão (pg-cloudflare reclama de leitura em soquete já fechado) não é falha:
  // sem ouvinte, o `pg` o transformaria em rejeição sem tratamento. Antes do fechamento, o erro segue para a consulta.
  pool.on('error', () => undefined);
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new WithSchemaPlugin('app')],
  });
}
