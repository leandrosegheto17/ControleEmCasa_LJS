import { DADOS_COLETADOS_SENTRY, limparEventoSentry, limparMigalhaSentry } from '@controle/contrato';
import * as Sentry from '@sentry/cloudflare';
import type { CloudflareOptions } from '@sentry/cloudflare';
import type { Bindings } from './env';

/**
 * Sentry no Worker (PLANO etapa 16; SDD 11.2; GUARDRAILS G-45; TM-OBS-01): `@sentry/cloudflare` com `withSentry`.
 *
 * - **Inerte sem DSN**: sem o segredo `SENTRY_DSN` (vazio ou ausente), a requisição e o cron vão direto ao handler, sem
 *   passar pelo SDK, e nada é relatado. O DSN só vem por `wrangler secret` (no local, `.dev.vars`), nunca do código.
 * - **Release = SHA do commit**: o `deploy.yml` injeta `--var SENTRY_RELEASE:<sha>`.
 * - **Limpeza**: `dataCollection` com tudo desligado e `beforeSend`/`beforeBreadcrumb` com a limpeza do contrato (a mesma
 *   do front). Sem tracing: transações são descartadas.
 * - O `onError` do Hono trata todo erro e devolve 500 genérico; por isso o erro inesperado é relatado à mão
 *   (`relatarErro`), com o id de correlação como tag. Os 4xx e os 503 de dependência fora do ar não vão ao Sentry.
 */

export function opcoesSentry(env: Bindings, extra: Partial<CloudflareOptions> = {}): CloudflareOptions | undefined {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return undefined;
  return {
    dsn,
    release: env.SENTRY_RELEASE?.trim() || undefined,
    environment: env.AMBIENTE,
    dataCollection: { ...DADOS_COLETADOS_SENTRY, httpBodies: [] },
    beforeSend: (evento) => limparEventoSentry(evento),
    beforeBreadcrumb: (migalha) => limparMigalhaSentry(migalha),
    beforeSendTransaction: () => null,
    ...extra,
  };
}

const temDsn = (env: Bindings) => Boolean(env.SENTRY_DSN?.trim());

/**
 * Envolve o handler do Worker com o Sentry, mas só usa a versão instrumentada quando há DSN. O `withSentry` altera o
 * objeto que recebe; por isso ele recebe uma cópia e o handler original fica intacto para o caminho sem DSN.
 * `extra` existe para os testes (transporte falso).
 */
export function comSentry(
  handler: ExportedHandler<Bindings>,
  extra: Partial<CloudflareOptions> = {},
): ExportedHandler<Bindings> {
  const instrumentado = Sentry.withSentry((env: Bindings) => opcoesSentry(env, extra), { ...handler });
  const saida: ExportedHandler<Bindings> = {};
  if (handler.fetch) {
    const direto = handler.fetch;
    const viaSentry = instrumentado.fetch!;
    saida.fetch = (pedido, env, ctx) => (temDsn(env) ? viaSentry : direto)(pedido, env, ctx);
  }
  if (handler.scheduled) {
    const direto = handler.scheduled;
    const viaSentry = instrumentado.scheduled!;
    saida.scheduled = (controlador, env, ctx) => (temDsn(env) ? viaSentry : direto)(controlador, env, ctx);
  }
  return saida;
}

/** Relata um erro inesperado (sem DSN, não faz nada). Só a tag do id de correlação vai junto; nada do pedido. */
export function relatarErro(env: Bindings, erro: unknown, id?: string): void {
  if (!temDsn(env)) return;
  Sentry.captureException(erro, id ? { tags: { id } } : undefined);
}
