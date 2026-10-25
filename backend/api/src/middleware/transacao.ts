import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { ErroApi } from '../erros';
import { emTransacaoComo } from '../infraestrutura/db/transacao';

class ReverterTransacao extends Error {}

/**
 * Middleware das rotas autenticadas (SDD 5.1 passos 7 e 8): sem sessão, 401 `sessao_expirada`; com sessão,
 * abre a transação com o GUC, deriva o vínculo no banco e roda o resto da cadeia dentro dela.
 * O Hono transforma exceção do handler em resposta antes de voltar aqui, então a reversão olha `c.error`
 * e o status: erro ou resposta 4xx/5xx desfaz tudo (ROLLBACK), e o GUC local some do mesmo jeito.
 */
export const emTransacao = createMiddleware<AppEnv>(async (c, next) => {
  const sessao = c.get('sessao');
  if (!sessao) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  try {
    await emTransacaoComo(c.get('db'), sessao, async (trx, vinculo) => {
      c.set('tx', trx);
      c.set('vinculo', vinculo);
      await next();
      if (c.error || c.res.status >= 400) throw new ReverterTransacao();
    });
  } catch (erro) {
    if (!(erro instanceof ReverterTransacao)) throw erro;
  }
});

/** Rotas que exigem lar (SDD 6, acesso "A"): autenticado sem vínculo ativo → 409 `sem_lar` (G-03). */
export const exigirLar = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('vinculo'))
    throw new ErroApi(409, 'sem_lar', 'Você ainda não tem um lar. Crie o seu ou aceite um convite.');
  return next();
});
