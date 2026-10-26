/**
 * MÓDULO ISOLADO de Web Push (SDD 2.2; decisão 4 do PLANO; ADR-014). Só `fetch` e `crypto.subtle`, sem SDK; não importa
 * nada do resto da API nem do banco (regra do ESLint e teste de fronteira), para ser extraído depois para os outros
 * apps. Interface (SDD 2.2): `enviarPush(assinatura, carga, vapid) → 'ok' | 'expirada' | 'falha'` e `chavePublica()`.
 */
export { enviarPush, TTL_PADRAO_SEGUNDOS } from './envio';
export { chavePublica, configVapidValida, gerarParVapid, VALIDADE_JWT_SEGUNDOS } from './vapid';
export { MAX_MENSAGEM_BYTES } from './cifra';
export type { AssinaturaPush, CargaPush, ConfigVapid, OpcoesEnvio, ResultadoPush, Urgencia } from './tipos';
