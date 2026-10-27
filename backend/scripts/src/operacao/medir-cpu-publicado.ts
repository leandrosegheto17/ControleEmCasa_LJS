import { API_CLOUDFLARE } from './cache-hyperdrive';

/**
 * Mede a CPU por requisição do Worker JÁ PUBLICADO, pela API de análise (GraphQL) da Cloudflare (RNF-04; SDD 10
 * "Medição publicada", pendente desde a etapa 9). Diz se o p50 e o p99 da janela passam do teto de 10 ms.
 *
 * [A VALIDAR NA 17C] O conjunto de dados (`workersInvocationsAdaptive`), os campos (`quantiles.cpuTimeP50`,
 * `cpuTimeP99`, em microssegundos; `sum.requests`) e o filtro (`scriptName`, `datetime_geq`/`datetime_leq`) vêm do
 * conhecimento da documentação, NÃO foram conferidos contra a Cloudflare nem executados: a primeira consulta real é da
 * feature 17c. Se o nome de algum campo mudou, só `CONSULTA` e `lerResposta` precisam de ajuste.
 *
 * Token e conta só por ambiente (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); o token nunca vai a nenhuma saída.
 * Como a medição de `medir-cpu.ts`, é um relatório de CPU por requisição em ms; aqui vem do runtime real, sem proxy.
 */

export const TETO_CPU_MS = 10;
export const SCRIPT_PADRAO = 'controle-em-casa';
const ID_CONTA = /^[0-9a-f]{32}$/;
const TOKEN_VALIDO = /^[A-Za-z0-9_-]+$/;

/** [A VALIDAR NA 17C] nomes de conjunto de dados e campos. */
export const CONSULTA = `query ($conta: String!, $script: String!, $desde: Time!, $ate: Time!) {
  viewer {
    accounts(filter: { accountTag: $conta }) {
      workersInvocationsAdaptive(
        limit: 1
        filter: { scriptName: $script, datetime_geq: $desde, datetime_leq: $ate }
      ) {
        sum { requests errors }
        quantiles { cpuTimeP50 cpuTimeP99 }
      }
    }
  }
}`;

export interface MedicaoPublicada {
  requisicoes: number;
  p50Ms: number;
  p99Ms: number;
}

export function montarConsulta(o: { conta: string; script: string; desde: Date; ate: Date }) {
  return {
    query: CONSULTA,
    variables: { conta: o.conta, script: o.script, desde: o.desde.toISOString(), ate: o.ate.toISOString() },
  };
}

interface LinhaAnalise {
  sum?: { requests?: unknown };
  quantiles?: { cpuTimeP50?: unknown; cpuTimeP99?: unknown };
}

interface CorpoAnalise {
  errors?: Array<{ message?: unknown }> | null;
  data?: { viewer?: { accounts?: Array<{ workersInvocationsAdaptive?: LinhaAnalise[] }> } } | null;
}

/**
 * Lê a resposta. Devolve `null` quando a janela não tem dados (nenhuma requisição); lança com mensagem clara quando a
 * API respondeu erro ou veio num formato inesperado.
 */
export function lerResposta(corpo: unknown): MedicaoPublicada | null {
  const c = (corpo ?? {}) as CorpoAnalise;
  if (Array.isArray(c.errors) && c.errors.length > 0) {
    const mensagem = c.errors.map((e) => (typeof e.message === 'string' ? e.message : 'erro sem mensagem')).join('; ');
    throw new Error(`A API de análise respondeu com erro: ${mensagem}`);
  }
  const contas = c.data?.viewer?.accounts;
  if (!Array.isArray(contas)) throw new Error('Resposta da API de análise em formato inesperado (sem accounts).');
  const linha = contas[0]?.workersInvocationsAdaptive?.[0];
  const requisicoes = Number(linha?.sum?.requests ?? 0);
  if (!linha || !(requisicoes > 0)) return null;
  const p50 = Number(linha.quantiles?.cpuTimeP50);
  const p99 = Number(linha.quantiles?.cpuTimeP99);
  if (!Number.isFinite(p50) || !Number.isFinite(p99)) {
    throw new Error('Resposta da API de análise sem os quantis de CPU (cpuTimeP50/cpuTimeP99).');
  }
  // A API devolve microssegundos.
  return { requisicoes, p50Ms: p50 / 1000, p99Ms: p99 / 1000 };
}

/** Regra do teto: passa só se p50 e p99 ficam no teto (inclusive). */
export function dentroDoTeto(m: MedicaoPublicada, tetoMs: number = TETO_CPU_MS): boolean {
  return m.p50Ms <= tetoMs && m.p99Ms <= tetoMs;
}

export function relatorio(m: MedicaoPublicada, janelaHoras: number, tetoMs: number = TETO_CPU_MS): string {
  const veredito = dentroDoTeto(m, tetoMs) ? 'DENTRO do teto' : 'ACIMA do teto';
  return [
    `janela: ${janelaHoras} h | requisições: ${m.requisicoes}`,
    `CPU por requisição: p50 ${m.p50Ms.toFixed(2)} ms | p99 ${m.p99Ms.toFixed(2)} ms | teto ${tetoMs} ms`,
    `${veredito} (RNF-04)`,
  ].join('\n');
}

export interface OpcoesMedicao {
  token: string;
  conta: string;
  script?: string;
  janelaHoras?: number;
  agora?: Date;
  fetch?: typeof fetch;
}

export async function medirPublicado(o: OpcoesMedicao): Promise<MedicaoPublicada | null> {
  if (!TOKEN_VALIDO.test(o.token)) throw new Error('CLOUDFLARE_API_TOKEN ausente ou fora do formato.');
  if (!ID_CONTA.test(o.conta)) throw new Error('CLOUDFLARE_ACCOUNT_ID ausente ou fora do formato.');
  const horas = o.janelaHoras ?? 24;
  if (!(horas > 0 && horas <= 24 * 30)) throw new Error('Janela fora do intervalo (1 a 720 horas).');
  const ate = o.agora ?? new Date();
  const desde = new Date(ate.getTime() - horas * 3_600_000);
  const buscar = o.fetch ?? fetch;
  const resposta = await buscar(`${API_CLOUDFLARE}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(montarConsulta({ conta: o.conta, script: o.script ?? SCRIPT_PADRAO, desde, ate })),
  });
  if (!resposta.ok) throw new Error(`A API de análise respondeu ${resposta.status}.`);
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    throw new Error('Resposta da API de análise não é JSON.');
  }
  return lerResposta(corpo);
}

export async function main(ambiente: NodeJS.ProcessEnv = process.env, buscar: typeof fetch = fetch): Promise<number> {
  const token = ambiente['CLOUDFLARE_API_TOKEN'] ?? '';
  try {
    const janelaHoras = Number(ambiente['JANELA_HORAS'] ?? 24);
    const m = await medirPublicado({
      token,
      conta: ambiente['CLOUDFLARE_ACCOUNT_ID'] ?? '',
      script: ambiente['WORKER_NOME'] || SCRIPT_PADRAO,
      janelaHoras,
      fetch: buscar,
    });
    if (!m) {
      console.error(
        `Sem dados na janela de ${janelaHoras} h: o Worker não recebeu requisições. Gere tráfego e repita.`,
      );
      return 1;
    }
    console.info(relatorio(m, janelaHoras));
    return dentroDoTeto(m) ? 0 : 1;
  } catch (erro) {
    let mensagem = (erro as Error).message;
    if (token) mensagem = mensagem.split(token).join('[removido]');
    console.error(mensagem);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
