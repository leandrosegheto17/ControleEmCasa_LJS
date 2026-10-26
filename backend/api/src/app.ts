import { LIMITES, VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '@controle/contrato';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { registrarRotasDeAcesso } from './entrada/rotas/acesso';
import { registrarRotasDeCadastros } from './entrada/rotas/cadastros';
import { registrarRotasDeConta } from './entrada/rotas/conta';
import { registrarRotasDeFixas } from './entrada/rotas/fixas';
import { registrarRotasDeLancamentos } from './entrada/rotas/lancamentos';
import { registrarRotasDeLar } from './entrada/rotas/lar';
import { registrarRotasDeOrcamentoEMetas } from './entrada/rotas/orcamento-metas';
import { registrarRotasDePlano } from './entrada/rotas/plano';
import { registrarRotasDePush } from './entrada/rotas/push';
import type { EnviadorPush } from './aplicacao/agendadas/push';
import type { AppEnv, Sessao } from './env';
import { ErroApi, ehErroDeConexao } from './erros';
import { ErroAsaas, type ClienteAsaas } from './infraestrutura/asaas';
import { traduzirErroDoBanco } from './infraestrutura/db/codigo-erro';
import type { Versoes } from './infraestrutura/db/repositorios/aceites';
import type { TransporteEmail } from './infraestrutura/email';
import { relogioDoSistema, type Relogio } from './infraestrutura/relogio';
import { logar } from './log';
import { cabecalhosDeSeguranca } from './middleware/cabecalhos';
import { conexaoDaRequisicao } from './middleware/conexao';
import { protecaoCsrf } from './middleware/csrf';
import { limitarPor } from './middleware/limite';
import { sessaoDoCookie } from './middleware/sessao';

/** Limite de corpo (SDD 5.1 passo 2; LIMITES.corpoBytes): 64 KiB. */
export const CORPO_MAXIMO_BYTES = LIMITES.corpoBytes;

/** Rotas sob `LIMITE_PUBLICO` (SDD 5.1 passo 3), inclusive as de convite e de exclusão por token (etapa 14). */
const ROTAS_LIMITE_PUBLICO = [
  '/api/cadastro',
  '/api/cadastro/confirmar',
  '/api/cadastro/reenviar',
  '/api/senha/esqueci',
  '/api/senha/redefinir',
  '/api/convites/atual',
  '/api/convites/aceitar',
  '/api/convites/recusar',
  '/api/conta/exclusao/confirmar',
];

export interface OpcoesDoApp {
  /** Resolve a sessão da requisição. Padrão: o cookie `__Host-sid` (etapa 4). Os testes de GUC trocam por outro. */
  resolverSessao?: (c: Context<AppEnv>) => Promise<Sessao | null>;
  /** Registra rotas depois dos middlewares comuns (usado pelas etapas seguintes e pelos testes). */
  rotas?: (app: Hono<AppEnv>) => void;
  /** Relógio injetável (testes de expiração e de janela de bloqueio). */
  relogio?: Relogio;
  /** Transporte de e-mail injetado (testes). */
  transporteEmail?: TransporteEmail;
  /** Versões vigentes dos termos e da privacidade (testes de reaceite, CA-19.7). */
  versoes?: Versoes;
  /** Cliente do Asaas injetado (testes: um falso). Sem ele, o REST real com `ASAAS_*` (etapa 13). */
  asaas?: ClienteAsaas;
  /** Envio de push injetado (testes: um falso). Sem ele, o módulo `infraestrutura/push` (etapa 15). */
  push?: EnviadorPush;
}

export function criarApp(opcoes: OpcoesDoApp = {}): Hono<AppEnv> {
  const resolverSessao = opcoes.resolverSessao ?? sessaoDoCookie;
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const versoes = opcoes.versoes ?? { termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE };
  const app = new Hono<AppEnv>();

  app.use('/api/*', cabecalhosDeSeguranca);

  // Saúde: responde antes de qualquer middleware que toque o banco (SDD 5.1, R5).
  app.get('/api/health', (c) => c.json({ ok: true }));

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: CORPO_MAXIMO_BYTES,
      onError: (c) => c.json({ code: 'corpo_grande', message: 'Corpo da requisição grande demais.' }, 413),
    }),
  );
  // Rate limit por IP (SDD 5.1 passo 3), antes do CSRF e do banco.
  app.use('/api/sessao/entrar', limitarPor('LIMITE_ENTRAR'));
  for (const rota of ROTAS_LIMITE_PUBLICO) app.use(rota, limitarPor('LIMITE_PUBLICO'));
  app.use('/api/webhooks/*', limitarPor('LIMITE_WEBHOOK'));
  app.use('/api/*', protecaoCsrf);
  app.use('/api/*', conexaoDaRequisicao);
  app.use('/api/*', async (c, next) => {
    c.set('agora', relogio());
    c.set('sessao', await resolverSessao(c));
    return next();
  });

  registrarRotasDeAcesso(app, { transporteEmail: opcoes.transporteEmail, versoes });
  registrarRotasDeConta(app, { transporteEmail: opcoes.transporteEmail, asaas: opcoes.asaas });
  registrarRotasDeLar(app, { transporteEmail: opcoes.transporteEmail, asaas: opcoes.asaas });
  registrarRotasDeCadastros(app);
  registrarRotasDeLancamentos(app);
  registrarRotasDeFixas(app);
  registrarRotasDeOrcamentoEMetas(app, { push: opcoes.push });
  registrarRotasDePush(app);
  opcoes.rotas?.(app);
  // Depois das rotas injetadas: um teste que troca o handler do webhook (ex.: o de CSRF, que só olha a exceção do
  // `/api/webhooks/*`) continua valendo. Em produção não há rota injetada e a ordem não muda nada.
  registrarRotasDePlano(app, { transporteEmail: opcoes.transporteEmail, asaas: opcoes.asaas });

  app.notFound((c) => c.json({ code: 'rota_inexistente', message: 'Rota inexistente.' }, 404));

  // Sem dado pessoal (G-46, G-47): o log leva só o nome do erro e o id de correlação; a resposta é genérica.
  app.onError((erro, c) => {
    if (erro instanceof ErroApi) {
      return c.json(
        { code: erro.code, message: erro.message, ...(erro.campos ? { campos: erro.campos } : {}) },
        erro.status,
      );
    }
    // Erro esperado do banco (unicidade, RLS, check): vira o código estável do SDD 7, sem a mensagem do Postgres.
    const traduzido = traduzirErroDoBanco(erro);
    if (traduzido) return c.json({ code: traduzido.code, message: traduzido.message }, traduzido.status);
    const id = c.get('idRequisicao') ?? 'sem-id';
    // Asaas fora do ar ou recusando (SDD 7): 503 `indisponivel`. O log leva só o motivo e o status, nunca o corpo.
    if (erro instanceof ErroAsaas) {
      logar('warn', 'asaas_indisponivel', { id, motivo: erro.motivo, status: erro.status ?? 0 });
      return c.json(
        { code: 'indisponivel', message: 'Serviço de pagamento indisponível. Tente novamente em instantes.' },
        503,
      );
    }
    if (ehErroDeConexao(erro)) {
      logar('warn', 'banco_indisponivel', { id, erro: erro.name });
      return c.json({ code: 'indisponivel', message: 'Serviço indisponível. Tente novamente em instantes.' }, 503);
    }
    logar('error', 'erro_interno', { id, erro: erro.name });
    return c.json({ code: 'erro_interno', message: 'Erro interno. Tente novamente.', id }, 500);
  });

  return app;
}

export const app = criarApp();
