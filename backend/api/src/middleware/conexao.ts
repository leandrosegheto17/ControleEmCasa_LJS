import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { criarDb } from '../infraestrutura/db/cliente';

/** Conclui `trabalho` fora do caminho da resposta (waitUntil); sem ExecutionContext (testes diretos), espera. */
async function aposResponder(c: Context<AppEnv>, trabalho: Promise<unknown>): Promise<void> {
  const seguro = trabalho.catch(() => undefined);
  try {
    c.executionCtx.waitUntil(seguro);
  } catch {
    await seguro;
  }
}

/**
 * Conexão da requisição (SDD 5.1 passo 5). O pool do `pg` é preguiçoso: rota que não consulta não conecta.
 * Fecha no `finally`, mesmo com erro.
 */
export const conexaoDaRequisicao = createMiddleware<AppEnv>(async (c, next) => {
  const db = criarDb(c.env.HYPERDRIVE.connectionString);
  c.set('db', db);
  try {
    await next();
  } finally {
    await aposResponder(c, db.destroy());
  }
});
