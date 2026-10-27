import { DADOS_COLETADOS_SENTRY, limparEventoSentry, limparMigalhaSentry } from '@controle/contrato';
import type { BrowserOptions } from '@sentry/react';

/**
 * Sentry no front (PLANO etapa 16; SDD 9.1 `configuracao/`, 11.2; GUARDRAILS G-45; TM-OBS-01): `@sentry/react`.
 *
 * - **Inerte sem DSN**: sem `VITE_SENTRY_DSN` no build, o SDK nem é carregado (import preguiçoso) e nada é relatado.
 *   O DSN vem só de variável de build (o `deploy.yml` lê a variável do GitHub), nunca do código.
 * - **Release = SHA do commit**: `VITE_SENTRY_RELEASE`, injetada pelo `deploy.yml`.
 * - **Limpeza**: a mesma do Worker (`@controle/contrato`): `dataCollection` desligado, `beforeSend` e `beforeBreadcrumb`.
 *   Sem tracing nem replay.
 * - Erros não tratados chegam pelo handler global do SDK (o React 19 os reporta com `reportError`); os erros pegos por
 *   um error boundary (ex.: o `errorElement` das rotas) são relatados por `aoErroCapturado`, ligado no `createRoot`.
 */

export interface AmbienteSentry {
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_RELEASE?: string;
  PROD?: boolean;
}

export interface ConfigSentryWeb {
  dsn: string;
  release: string | undefined;
  environment: 'producao' | 'local';
}

export function lerConfigSentry(ambiente: AmbienteSentry): ConfigSentryWeb | null {
  const dsn = ambiente.VITE_SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    release: ambiente.VITE_SENTRY_RELEASE?.trim() || undefined,
    environment: ambiente.PROD ? 'producao' : 'local',
  };
}

export function opcoesSentryWeb(config: ConfigSentryWeb, extra: Partial<BrowserOptions> = {}): BrowserOptions {
  return {
    dsn: config.dsn,
    release: config.release,
    environment: config.environment,
    dataCollection: { ...DADOS_COLETADOS_SENTRY, httpBodies: [] },
    beforeSend: (evento) => limparEventoSentry(evento),
    beforeBreadcrumb: (migalha) => limparMigalhaSentry(migalha),
    beforeSendTransaction: () => null,
    ...extra,
  };
}

type Sdk = Pick<typeof import('@sentry/react'), 'init' | 'captureException'>;

let relatar: ((erro: unknown) => void) | null = null;

/**
 * Liga o Sentry se houver DSN. Devolve se ligou. `carregar` e `extra` existem para os testes (SDK e transporte falsos).
 */
export async function iniciarSentry(
  ambiente: AmbienteSentry = import.meta.env,
  carregar: () => Promise<Sdk> = () => import('@sentry/react'),
  extra: Partial<BrowserOptions> = {},
): Promise<boolean> {
  const config = lerConfigSentry(ambiente);
  if (!config) return false;
  const sdk = await carregar();
  sdk.init(opcoesSentryWeb(config, extra));
  relatar = (erro) => sdk.captureException(erro);
  return true;
}

/** Relata um erro ao Sentry, se ele estiver ligado; senão não faz nada. */
export function relatarErroWeb(erro: unknown): void {
  relatar?.(erro);
}

/** `onCaughtError` do `createRoot`: relata e mantém o aviso no console, como o React faz por padrão. */
export function aoErroCapturado(erro: unknown): void {
  relatarErroWeb(erro);
  console.error(erro);
}

/** Só para os testes: volta ao estado sem Sentry. */
export function desligarSentryParaTeste(): void {
  relatar = null;
}
