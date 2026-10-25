import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv, Sessao } from './env';
import { ErroApi, ehErroDeConexao } from './erros';
import { logar } from './log';
import { cabecalhosDeSeguranca } from './middleware/cabecalhos';
import { conexaoDaRequisicao } from './middleware/conexao';
import { protecaoCsrf } from './middleware/csrf';

/** Limite de corpo (SDD 5.1 passo 2; LIMITES.corpoBytes): 64 KiB. */
export const CORPO_MAXIMO_BYTES = 64 * 1024;

export interface OpcoesDoApp {
  /** Resolve a sessão da requisição. A etapa 4 liga o cookie `__Host-sid`; até lá, ninguém tem sessão. */
  resolverSessao?: (c: Context<AppEnv>) => Promise<Sessao | null>;
  /** Registra rotas depois dos middlewares comuns (usado pelas etapas seguintes e pelos testes). */
  rotas?: (app: Hono<AppEnv>) => void;
}

export function criarApp(opcoes: OpcoesDoApp = {}): Hono<AppEnv> {
  const resolverSessao = opcoes.resolverSessao ?? (async () => null);
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
  // Rate limit por IP (SDD 5.1 passo 3): os bindings LIMITE_* estão no wrangler.jsonc; o uso entra na etapa 4.
  app.use('/api/*', protecaoCsrf);
  app.use('/api/*', conexaoDaRequisicao);
  app.use('/api/*', async (c, next) => {
    c.set('sessao', await resolverSessao(c));
    return next();
  });

  opcoes.rotas?.(app);

  app.notFound((c) => c.json({ code: 'rota_inexistente', message: 'Rota inexistente.' }, 404));

  // Sem dado pessoal (G-46, G-47): o log leva só o nome do erro e o id de correlação; a resposta é genérica.
  app.onError((erro, c) => {
    if (erro instanceof ErroApi) {
      return c.json({ code: erro.code, message: erro.message }, erro.status);
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
