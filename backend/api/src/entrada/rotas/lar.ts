import { entrada } from '@controle/contrato';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { aceitarConvite, conviteAtual, convidar, recusarConvite, revogarConvite } from '../../aplicacao/lar/convites';
import {
  erroConviteInvalido,
  erroRegistroInvalido,
  erroTitularObrigatorio,
  type DepsConvite,
  type DepsLar,
} from '../../aplicacao/lar/comum';
import { criarLar, detalheLar, removerMembro, renomearLar, sairDoLar } from '../../aplicacao/lar/lar';
import { lerConfig } from '../../config';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import { criarEnviadorDeEmail, type TransporteEmail } from '../../infraestrutura/email';
import { transporteDoAmbiente } from '../../infraestrutura/transporte-email-ambiente';
import { emTransacao, exigirLar } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { agendarDe } from './comum';

export interface OpcoesLar {
  /** Transporte de e-mail injetado (testes); sem ele, vale o do ambiente (Resend, console em local). */
  transporteEmail?: TransporteEmail;
}

const Uuid = z.uuid();

function depsDe(c: Context<AppEnv>): DepsLar {
  const sessao = c.get('sessao');
  if (!sessao) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  return { tx: c.get('tx'), agora: c.get('agora'), sessao, vinculo: c.get('vinculo') };
}

/** Id de rota: malformado é tratado como inexistente (mesma resposta; RT-01). */
function idDaRota(c: Context<AppEnv>): string {
  const id = c.req.param('id');
  if (!Uuid.safeParse(id).success) throw erroRegistroInvalido();
  return id as string;
}

/**
 * Rotas de lar e convite (SDD 6.2; RN-22, RN-23). "A" = autenticado com lar (`exigirLar`, senão 409 `sem_lar`);
 * "A0" = autenticado sem exigir lar. O lar de toda rota é o do vínculo derivado no banco (G-03).
 */
export function registrarRotasDeLar(app: Hono<AppEnv>, opcoes: OpcoesLar = {}): void {
  function depsConviteDe(c: Context<AppEnv>): DepsConvite {
    const config = lerConfig(c.env as unknown as Record<string, unknown>);
    return {
      ...depsDe(c),
      email: criarEnviadorDeEmail(opcoes.transporteEmail ?? transporteDoAmbiente(config)),
      urlPublica: config.urlPublica,
      agendar: agendarDe(c),
    };
  }

  // Primeiro acesso (A0): 201 com o lar novo; 200 com o lar atual para quem já tem (idempotente).
  app.post('/api/lar', emTransacao, async (c) => {
    const dados = await lerCorpo(c, entrada.CriarLar);
    const r = await criarLar(depsDe(c), dados);
    return c.json(r.lar, r.criado ? 201 : 200);
  });

  app.get('/api/lar', emTransacao, exigirLar, async (c) => c.json(await detalheLar(depsDe(c)), 200));

  app.patch('/api/lar', emTransacao, exigirLar, async (c) => {
    const deps = depsDe(c);
    // A recusa de papel vem antes da validação do corpo (RT-02).
    if (deps.vinculo?.papel !== 'titular') throw erroTitularObrigatorio();
    const { nome } = await lerCorpo(c, entrada.AtualizarLar);
    await renomearLar(deps, nome);
    return c.body(null, 204);
  });

  app.delete('/api/lar/membros/:id', emTransacao, exigirLar, async (c) => {
    await removerMembro(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  app.post('/api/lar/sair', emTransacao, exigirLar, async (c) => {
    await sairDoLar(depsDe(c));
    return c.body(null, 204);
  });

  app.post('/api/lar/convites', emTransacao, exigirLar, async (c) => {
    const deps = depsConviteDe(c);
    // Não titular: `registro_invalido` antes de olhar o corpo (CA-23.2; RT-02).
    if (deps.vinculo?.papel !== 'titular') throw erroRegistroInvalido();
    const { email } = await lerCorpo(c, entrada.Convidar);
    return c.json(await convidar(deps, email), 201);
  });

  app.delete('/api/lar/convites/:id', emTransacao, exigirLar, async (c) => {
    const deps = depsDe(c);
    if (deps.vinculo?.papel !== 'titular') throw erroRegistroInvalido();
    await revogarConvite(deps, idDaRota(c));
    return c.body(null, 204);
  });

  // Convidado (A0, LIMITE_PUBLICO): o token vem do fragmento do link, lido pela tela (D-07).
  app.get('/api/convites/atual', emTransacao, async (c) => {
    const token = c.req.query('token');
    if (!token) throw erroConviteInvalido();
    return c.json(await conviteAtual(depsDe(c), token), 200);
  });

  app.post('/api/convites/aceitar', emTransacao, async (c) => {
    const { token } = await lerCorpo(c, entrada.TokenConvite);
    await aceitarConvite(depsDe(c), token);
    return c.body(null, 204);
  });

  app.post('/api/convites/recusar', emTransacao, async (c) => {
    const { token } = await lerCorpo(c, entrada.TokenConvite);
    await recusarConvite(depsDe(c), token);
    return c.body(null, 204);
  });
}
