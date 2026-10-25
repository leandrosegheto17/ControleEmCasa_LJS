import { env } from 'cloudflare:workers';
import type { Hono } from 'hono';
import { inject } from 'vitest';
import type { AppEnv, Bindings } from './env';

/** Contexto de execução mínimo para chamadas diretas a `app.request` (waitUntil só engole falhas da promessa). */
export function contextoFalso(): ExecutionContext {
  return {
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
}

export const bancoDisponivel = inject('bancoDisponivel');

export const ORIGEM = 'https://teste.exemplo.local';
export const ESCRITA = { 'X-Controle-Em-Casa': '1', Origin: ORIGEM };

/** Chama o app em processo com os bindings reais do teste (Hyperdrive local) e ajustes opcionais. */
export function chamar(
  app: Hono<AppEnv>,
  caminho: string,
  init?: RequestInit,
  ajustes: Partial<Bindings> = {},
): Promise<Response> {
  return Promise.resolve(app.request(caminho, init, { ...env, ...ajustes } as Bindings, contextoFalso()));
}
