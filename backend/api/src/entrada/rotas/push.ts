import { entrada } from '@controle/contrato';
import type { Context, Hono } from 'hono';
import { avisarMetaAtingida, type EnviadorPush } from '../../aplicacao/agendadas/push';
import { definirPreferencias, inscreverAparelho, obterPreferencias, removerAparelho } from '../../aplicacao/push/push';
import { lerConfigPush } from '../../config';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import { criarDb } from '../../infraestrutura/db/cliente';
import { chavePublica, enviarPush } from '../../infraestrutura/push';
import { emTransacao, exigirLar } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { depsDe } from './comum';

export interface OpcoesPush {
  /** Envio injetado (testes: um falso; nada sai para um serviço de push). Sem ele, o módulo `infraestrutura/push`. */
  push?: EnviadorPush;
}

const erroIndisponivel = () =>
  new ErroApi(503, 'indisponivel', 'Notificações indisponíveis no momento. Tente novamente mais tarde.');

/**
 * Rotas do push (SDD 6.2 "Push"; RN-27; TM-PUSH-04; ADR-014). Todas autenticadas; o dono vem da sessão (G-03).
 * - `GET /api/push/chave` → `{ chave_publica }` (sem lar: a chave é a mesma para todos) | 503 `indisponivel` sem VAPID.
 * - `POST /api/push/assinaturas` (com lar) `{endpoint, keys}` → 204, idempotente pelo endpoint.
 * - `DELETE /api/push/assinaturas` `{endpoint}` → 204 (sem lar: quem saiu do lar ainda limpa o aparelho; G-39).
 * - `GET`/`PUT /api/notificacoes/preferencias` (com lar) → `saida.Preferencias` / 204.
 */
export function registrarRotasDePush(app: Hono<AppEnv>): void {
  app.get('/api/push/chave', async (c) => {
    if (!c.get('sessao')) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
    const vapid = lerConfigPush(c.env as unknown as Record<string, unknown>);
    if (!vapid) throw erroIndisponivel();
    return c.json({ chave_publica: chavePublica(vapid) }, 200);
  });

  app.post('/api/push/assinaturas', emTransacao, exigirLar, async (c) => {
    const dados = await lerCorpo(c, entrada.AssinaturaPush);
    await inscreverAparelho(depsDe(c), dados);
    return c.body(null, 204);
  });

  app.delete('/api/push/assinaturas', emTransacao, async (c) => {
    const { endpoint } = await lerCorpo(c, entrada.RemoverAssinaturaPush);
    await removerAparelho(depsDe(c), endpoint);
    return c.body(null, 204);
  });

  app.get('/api/notificacoes/preferencias', emTransacao, exigirLar, async (c) =>
    c.json(await obterPreferencias(depsDe(c)), 200),
  );

  app.put('/api/notificacoes/preferencias', emTransacao, exigirLar, async (c) => {
    const dados = await lerCorpo(c, entrada.Preferencias);
    await definirPreferencias(depsDe(c), dados);
    return c.body(null, 204);
  });
}

/**
 * Agenda o push "meta atingida" para DEPOIS do COMMIT da rota (SDD 8.6). Usa uma conexão própria (a da requisição
 * fecha ao responder) e não toca a resposta: falha só vai ao log do caso de uso.
 */
export function agendarMetaAtingida(
  c: Context<AppEnv>,
  opcoes: OpcoesPush,
  dados: { larId: string; metaId: string; destinatarios: string[] },
): void {
  const env = c.env;
  const agora = c.get('agora');
  c.get('aposCommit').push(async () => {
    const vapid = lerConfigPush(env as unknown as Record<string, unknown>);
    if (!vapid) return;
    const db = criarDb(env.HYPERDRIVE.connectionString);
    try {
      await avisarMetaAtingida({ db, agora, vapid, enviar: opcoes.push ?? enviarPush }, dados);
    } finally {
      await db.destroy();
    }
  });
}
