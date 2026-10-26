import { traduzirFalhaDeEnvio, traduzirResposta } from './erros';

/** Único lugar do front com `fetch` (SDD 9.2; G-21, G-39). */

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Cabeçalho que toda escrita leva (CSRF por cabeçalho, G-21). O `Origin` o navegador envia sozinho. */
export const CABECALHO_CSRF = 'X-Controle-Em-Casa';
export const PRAZO_MS = 10_000;

const SEM_EFEITO: ReadonlySet<Metodo> = new Set(['GET']);

export interface OpcoesChamada {
  /**
   * Nome do schema Zod `saida.*` que confere a resposta. Só vale em desenvolvimento e teste; em produção o contrato
   * nem é carregado (import com literal, descartado pelo build), só os tipos.
   */
  saida?: keyof (typeof import('@controle/contrato'))['saida'];
  /** Igual a `saida`, para respostas que são uma lista: o schema confere cada item (só em desenvolvimento e teste). */
  saidaLista?: keyof (typeof import('@controle/contrato'))['saida'];
  /** Uma resposta 401 esperada (ex.: `GET /api/sessao`) não aciona o aviso global de sessão perdida. */
  semAvisoDeSessao?: boolean;
}

let aoPerderSessao: (() => void) | undefined;

/** Registra quem reage a um 401 em qualquer chamada: limpar cache e aparelho e levar a `/entrar?volta=` (SDD 9.2). */
export function definirAoPerderSessao(ouvinte: (() => void) | undefined): void {
  aoPerderSessao = ouvinte;
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text().catch(() => '');
  if (!texto) return undefined;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * `fetch('/api/…')` com o cookie `__Host-sid` (`credentials: 'same-origin'`; o front não o lê, é HttpOnly).
 * Devolve o JSON da resposta (ou `undefined` em 202/204). Falhas viram `ErroDados` (SDD 9.2) lançado como valor.
 */
export async function chamar<T = void>(
  metodo: Metodo,
  rota: string,
  corpo?: unknown,
  opcoes: OpcoesChamada = {},
): Promise<T> {
  // Só a API do próprio app: nunca uma URL montada de fora (G-33).
  if (!rota.startsWith('/api/')) throw new Error('rota_fora_da_api');

  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  if (!SEM_EFEITO.has(metodo)) cabecalhos[CABECALHO_CSRF] = '1';
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), PRAZO_MS);
  let resposta: Response;
  try {
    resposta = await fetch(rota, {
      method: metodo,
      headers: cabecalhos,
      credentials: 'same-origin',
      cache: 'no-store',
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controle.signal,
    });
  } catch (e) {
    throw traduzirFalhaDeEnvio(e);
  } finally {
    clearTimeout(relogio);
  }

  const json = await lerCorpo(resposta);
  if (!resposta.ok) {
    const erro = traduzirResposta(resposta.status, json);
    if (erro.tipo === 'autenticacao' && !opcoes.semAvisoDeSessao) aoPerderSessao?.();
    throw erro;
  }
  if (opcoes.saida && import.meta.env.MODE !== 'production') {
    const { saida } = await import('@controle/contrato');
    saida[opcoes.saida].parse(json);
  }
  if (opcoes.saidaLista && import.meta.env.MODE !== 'production') {
    const { saida } = await import('@controle/contrato');
    if (!Array.isArray(json)) throw new Error('resposta_fora_do_contrato');
    for (const item of json) saida[opcoes.saidaLista].parse(item);
  }
  return json as T;
}
