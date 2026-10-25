import { LIMITES, VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '@controle/contrato';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { registrarRotasDeAcesso } from './entrada/rotas/acesso';
import type { AppEnv, Sessao } from './env';
import { ErroApi, ehErroDeConexao } from './erros';
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

/** Rotas públicas sob `LIMITE_PUBLICO` (SDD 5.1 passo 3). Convites e exclusão entram nas etapas 6 e 14. */
const ROTAS_LIMITE_PUBLICO = [
  '/api/cadastro',
  '/api/cadastro/confirmar',
  '/api/cadastro/reenviar',
  '/api/senha/esqueci',
  '/api/senha/redefinir',
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
  app.use('/api/*', protecaoCsrf);
  app.use('/api/*', conexaoDaRequisicao);
  app.use('/api/*', async (c, next) => {
    c.set('agora', relogio());
    c.set('sessao', await resolverSessao(c));
    return next();
  });

  registrarRotasDeAcesso(app, { transporteEmail: opcoes.transporteEmail, versoes });
  opcoes.rotas?.(app);

  app.notFound((c) => c.json({ code: 'rota_inexistente', message: 'Rota inexistente.' }, 404));

  // Sem dado pessoal (G-46, G-47): o log leva só o nome do erro e o id de correlação; a resposta é genérica.
  app.onError((erro, c) => {
    if (erro instanceof ErroApi) {
      return c.json(
        { code: erro.code, message: erro.message, ...(erro.campos ? { campos: erro.campos } : {}) },
        erro.status,
      );
    }
    const id = c.get('idRequisicao') ?? 'sem-id';
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
