import type { Context } from 'hono';
import { z } from 'zod';
import type { DepsLar } from '../../aplicacao/lar/comum';
import { erroRegistroInvalido } from '../../aplicacao/lar/comum';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';

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

/** Dependências dos casos de uso autenticados: transação da requisição, relógio, sessão e vínculo (G-03). */
export function depsDe(c: Context<AppEnv>): DepsLar {
  const sessao = c.get('sessao');
  if (!sessao) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  return { tx: c.get('tx'), agora: c.get('agora'), sessao, vinculo: c.get('vinculo') };
}

const Uuid = z.uuid();

/** Id de rota: malformado é tratado como inexistente (mesma resposta; RT-01). */
export function idDaRota(c: Context<AppEnv>, parametro = 'id'): string {
  const id = c.req.param(parametro);
  if (!Uuid.safeParse(id).success) throw erroRegistroInvalido();
  return id as string;
}
