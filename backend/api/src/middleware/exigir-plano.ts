import { planoEfetivo, type PlanoEfetivo } from '@controle/dominio';
import { createMiddleware } from 'hono/factory';
import { erroPlanoNecessario, estadoDe } from '../aplicacao/plano/comum';
import type { AppEnv } from '../env';
import { buscarAssinaturaAtual } from '../infraestrutura/db/repositorios/assinaturas';

/**
 * `exigePlano` (SDD 5.1 passo 9 e 5.4; RN-25; G-30; TM-API-09). Vai DEPOIS de `emTransacao` e `exigirLar` e ANTES de
 * ler a rota e o corpo (RT-02: `plano_necessario` vem antes de `registro_invalido` e de `valor_invalido`; CA-T2.3).
 * A assinatura é lida na transação, pela RLS do lar, a cada requisição; o plano efetivo sai de `dominio/plano.ts`.
 * Sem o plano: 403 `plano_necessario`, sem gravar nada (CA-25.2, CA-25.3).
 */
export function exigePlano(plano: PlanoEfetivo) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const linha = await buscarAssinaturaAtual(c.get('tx'));
    const efetivo = planoEfetivo(linha ? estadoDe(linha) : null, c.get('agora'));
    if (plano === 'pro' && efetivo !== 'pro') throw erroPlanoNecessario();
    return next();
  });
}
