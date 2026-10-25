import { entrada } from '@controle/contrato';
import type { Context, Hono } from 'hono';
import { cadastrar, confirmarCadastro, reenviarConfirmacao } from '../../aplicacao/acesso/cadastro';
import type { DepsAcesso } from '../../aplicacao/acesso/comum';
import { entrar } from '../../aplicacao/acesso/entrar';
import { pedirRecuperacao, redefinirSenha } from '../../aplicacao/acesso/senha';
import { aceitarTermos, sair, sairDeTodos, sessaoAtual } from '../../aplicacao/acesso/sessao';
import { lerConfig } from '../../config';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import type { Versoes } from '../../infraestrutura/db/repositorios/aceites';
import { criarEnviadorDeEmail, type TransporteEmail } from '../../infraestrutura/email';
import { importarChaveHmac, type ChaveHmac } from '../../infraestrutura/seguranca/hmac';
import { definirCookieSessao, lerTokenSessao, limparCookieSessao } from '../../infraestrutura/sessao/cookie';
import { transporteDoAmbiente } from '../../infraestrutura/transporte-email-ambiente';
import { ipDoCliente } from '../../middleware/limite';
import { emTransacao } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { agendarDe } from './comum';

export interface OpcoesAcesso {
  /** Transporte de e-mail injetado (testes); sem ele, vale o do ambiente (Resend, console em local). */
  transporteEmail?: TransporteEmail;
  /** Versões vigentes dos termos e da privacidade (padrão: as do contrato). */
  versoes: Versoes;
}

const chaves = new Map<string, Promise<ChaveHmac>>();
function chaveHmacDe(base64url: string): Promise<ChaveHmac> {
  let chave = chaves.get(base64url);
  if (!chave) {
    chave = importarChaveHmac(base64url);
    chaves.set(base64url, chave);
  }
  return chave;
}

function exigirSessao(c: Context<AppEnv>) {
  const sessao = c.get('sessao');
  if (!sessao) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  return sessao;
}

/** Rotas de acesso (SDD 6.2: cadastro, sessão, senha e termos). */
export function registrarRotasDeAcesso(app: Hono<AppEnv>, opcoes: OpcoesAcesso): void {
  async function depsDe(c: Context<AppEnv>): Promise<DepsAcesso> {
    const config = lerConfig(c.env as unknown as Record<string, unknown>);
    return {
      db: c.get('db'),
      agora: c.get('agora'),
      chaveHmac: await chaveHmacDe(config.chaveHmac),
      email: criarEnviadorDeEmail(opcoes.transporteEmail ?? transporteDoAmbiente(config)),
      urlPublica: config.urlPublica,
      versoes: opcoes.versoes,
      agendar: agendarDe(c),
    };
  }

  // Cadastro e confirmação (RN-19). As respostas neutras (202) não têm corpo: idênticas byte a byte (G-19).
  app.post('/api/cadastro', async (c) => {
    const dados = await lerCorpo(c, entrada.Cadastro);
    await cadastrar(await depsDe(c), dados);
    return c.body(null, 202);
  });
  app.post('/api/cadastro/confirmar', async (c) => {
    const { token } = await lerCorpo(c, entrada.Confirmar);
    await confirmarCadastro(await depsDe(c), token);
    return c.body(null, 204);
  });
  app.post('/api/cadastro/reenviar', async (c) => {
    const { email } = await lerCorpo(c, entrada.Reenviar);
    await reenviarConfirmacao(await depsDe(c), email);
    return c.body(null, 202);
  });

  // Sessão (RN-20, RN-21).
  app.post('/api/sessao/entrar', async (c) => {
    const dados = await lerCorpo(c, entrada.Entrar);
    const token = await entrar(await depsDe(c), { ...dados, ip: ipDoCliente(c), tokenAnterior: lerTokenSessao(c) });
    definirCookieSessao(c, token);
    return c.body(null, 204);
  });
  app.get('/api/sessao', emTransacao, async (c) => {
    const sessao = exigirSessao(c);
    return c.json(await sessaoAtual(c.get('tx'), sessao.usuarioId, opcoes.versoes, c.get('vinculo')), 200);
  });
  // Sair é idempotente: revoga a sessão do cookie (se houver) e limpa o cookie (CA-20.4).
  app.post('/api/sessao/sair', async (c) => {
    await sair(c.get('db'), lerTokenSessao(c));
    limparCookieSessao(c);
    return c.body(null, 204);
  });
  // Sair de todos (CA-20.5): revoga todas as sessões do usuário; repetir (já sem sessão) é sucesso sem efeito.
  app.post('/api/sessao/sair-de-todos', async (c) => {
    const sessao = c.get('sessao');
    if (sessao) await sairDeTodos(c.get('db'), sessao.usuarioId);
    limparCookieSessao(c);
    return c.body(null, 204);
  });

  // Senha (CA-19.6).
  app.post('/api/senha/esqueci', async (c) => {
    const { email } = await lerCorpo(c, entrada.Esqueci);
    await pedirRecuperacao(await depsDe(c), email);
    return c.body(null, 202);
  });
  app.post('/api/senha/redefinir', async (c) => {
    const dados = await lerCorpo(c, entrada.Redefinir);
    await redefinirSenha(await depsDe(c), dados);
    limparCookieSessao(c);
    return c.body(null, 204);
  });

  // Termos (CA-19.7, G-48).
  app.post('/api/termos/aceite', emTransacao, async (c) => {
    const sessao = exigirSessao(c);
    const aceite = await lerCorpo(c, entrada.AceiteTermos);
    await aceitarTermos(c.get('tx'), {
      usuarioId: sessao.usuarioId,
      aceite,
      vigentes: opcoes.versoes,
      agora: c.get('agora'),
    });
    return c.body(null, 204);
  });
}
