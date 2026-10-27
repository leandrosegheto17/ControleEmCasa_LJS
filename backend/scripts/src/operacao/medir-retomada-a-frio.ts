/**
 * Mede a retomada a frio do banco (RNF-05): a PRIMEIRA requisição que toca o banco depois de um tempo parado (o Neon
 * suspende o compute sem uso) contra as seguintes, e registra a diferença. `/api/health` NÃO serve: responde sem tocar o
 * banco (SDD 5.1), então nunca acordaria o compute e a medição sairia sempre "rápida".
 *
 * Uso (depois de deixar o app parado por mais que o tempo de suspensão do Neon, ver `.specs/etapa-17/neon.md`):
 *   URL_PUBLICA=https://… MEDIR_COOKIE='__Host-sid=…' pnpm --filter @controle/scripts medir-retomada-a-frio [rota]
 * Opcionais: `REPETICOES` (padrão 5, além da primeira) e `ESPERA_MIN` (minutos de espera antes da primeira, padrão 0).
 *
 * O cookie vem só do ambiente e nunca vai a nenhuma saída. A rota padrão `/api/sessao` toca o banco quando há sessão
 * válida; sem cookie ela pararia antes (401), por isso o cookie é obrigatório. [A VALIDAR NA 17C] com a produção real.
 */

/** Rotas conhecidas que abrem transação no banco (com sessão válida). `/api/health` fica de fora de propósito. */
export const ROTAS_COM_BANCO = ['/api/sessao', '/api/contas', '/api/formas', '/api/categorias', '/api/lar'] as const;
export const ROTA_PADRAO = '/api/sessao';

/** Só aceita rota da lista que toca o banco; `/api/health` (e qualquer outra) é recusada. */
export function rotaQueTocaBanco(rota: string): boolean {
  const caminho = rota.split(/[?#]/)[0] ?? '';
  return (ROTAS_COM_BANCO as readonly string[]).includes(caminho);
}

export interface ResumoRetomada {
  primeiraMs: number;
  medianaSeguintesMs: number;
  diferencaMs: number;
}

function mediana(valores: number[]): number {
  const o = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[meio]! : (o[meio - 1]! + o[meio]!) / 2;
}

/** Primeira requisição contra a mediana das seguintes. Precisa de pelo menos uma seguinte. */
export function resumir(temposMs: number[]): ResumoRetomada {
  if (temposMs.length < 2) throw new RangeError('É preciso a primeira requisição e pelo menos uma seguinte.');
  const [primeiraMs, ...seguintes] = temposMs as [number, ...number[]];
  const medianaSeguintesMs = mediana(seguintes);
  return { primeiraMs, medianaSeguintesMs, diferencaMs: primeiraMs - medianaSeguintesMs };
}

export function relatorio(r: ResumoRetomada, rota: string): string {
  return [
    `rota: ${rota}`,
    `primeira (a frio): ${r.primeiraMs.toFixed(0)} ms | mediana das seguintes: ${r.medianaSeguintesMs.toFixed(0)} ms`,
    `custo da retomada a frio: ${r.diferencaMs.toFixed(0)} ms`,
  ].join('\n');
}

export interface OpcoesMedicao {
  base: string;
  rota: string;
  cookie: string;
  repeticoes?: number;
  fetch?: typeof fetch;
  relogio?: () => number;
}

/** Faz 1 + `repeticoes` requisições seguidas e devolve o tempo de cada uma (ms). Resposta diferente de 200 lança. */
export async function medirTempos(o: OpcoesMedicao): Promise<number[]> {
  if (!rotaQueTocaBanco(o.rota)) {
    throw new Error(
      `A rota ${o.rota} não toca o banco (ou não está na lista): /api/health não serve para medir a retomada a frio.`,
    );
  }
  if (!o.cookie) throw new Error('MEDIR_COOKIE ausente: sem sessão a rota para antes do banco.');
  const buscar = o.fetch ?? fetch;
  const agora = o.relogio ?? (() => performance.now());
  const n = o.repeticoes ?? 5;
  const tempos: number[] = [];
  for (let i = 0; i < n + 1; i += 1) {
    const inicio = agora();
    const resposta = await buscar(`${o.base}${o.rota}`, { headers: { Cookie: o.cookie } });
    await resposta.arrayBuffer();
    const fim = agora();
    if (resposta.status !== 200) throw new Error(`A rota ${o.rota} respondeu ${resposta.status} (esperado 200).`);
    tempos.push(fim - inicio);
  }
  return tempos;
}

export async function main(
  ambiente: NodeJS.ProcessEnv = process.env,
  argumentos: string[] = process.argv.slice(2),
  buscar: typeof fetch = fetch,
): Promise<number> {
  const rota = argumentos[0] ?? ROTA_PADRAO;
  const cookie = ambiente['MEDIR_COOKIE'] ?? '';
  try {
    const base = (ambiente['URL_PUBLICA'] ?? '').replace(/\/+$/, '');
    if (!/^https?:\/\/[^/\s]+$/.test(base)) throw new Error('URL_PUBLICA ausente ou fora do formato (https://host).');
    const espera = Number(ambiente['ESPERA_MIN'] ?? 0);
    if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera * 60_000));
    const tempos = await medirTempos({
      base,
      rota,
      cookie,
      repeticoes: Number(ambiente['REPETICOES'] ?? 5),
      fetch: buscar,
    });
    console.info(relatorio(resumir(tempos), rota));
    return 0;
  } catch (erro) {
    let mensagem = (erro as Error).message;
    if (cookie) mensagem = mensagem.split(cookie).join('[removido]');
    console.error(mensagem);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
