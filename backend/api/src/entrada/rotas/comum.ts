import type { Context } from 'hono';
import type { AppEnv } from '../../env';

/** Conclui o trabalho fora do caminho da resposta (`ctx.waitUntil`): o envio de e-mail não pesa no tempo (G-19). */
export function agendarDe(c: Context<AppEnv>): (trabalho: Promise<unknown>) => void {
  return (trabalho) => {
    const seguro = trabalho.catch(() => undefined);
    try {
      c.executionCtx.waitUntil(seguro);
    } catch {
      // sem ExecutionContext (chamada direta): a promessa segue sozinha
    }
  };
}
