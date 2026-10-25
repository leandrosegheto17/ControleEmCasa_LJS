import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Medição de CPU por requisição no `wrangler dev` (PLANO etapa 9; RNF-04; SDD 10 "Medição"; risco R1).
 *
 * Método: tempo de CPU do(s) processo(s) `workerd` do `wrangler dev` (usuário + sistema, lido do sistema
 * operacional) antes e depois de N requisições SEQUENCIAIS à mesma rota, dividido por N. Espera de banco não gasta
 * CPU; parse, JSON, lógica, cripto do login no Postgres e o próprio runtime gastam. É um TETO da CPU que o isolate
 * gastaria: inclui o proxy do wrangler, o HTTP local e a conexão nova com o Postgres a cada requisição.
 * O perfilador do V8 pelo inspetor não serve aqui: no Windows ele amostra a poucos ms e o workerd não marca o
 * tempo ocioso, então a espera do banco aparece como CPU.
 *
 * Uso (com o `wrangler dev` no ar e a massa gravada por `massa`):
 *   MASSA_COOKIE='__Host-sid=…' WORKERD_PIDS=123,456 pnpm --filter @controle/scripts medir-cpu [rota ...]
 */

/** CPU média por requisição (ms), descontando a média da rota de referência sem banco (`/api/health`). */
export function cpuPorRequisicao(entrada: {
  cpuAntesMs: number;
  cpuDepoisMs: number;
  requisicoes: number;
  referenciaMs?: number;
}): { brutoMs: number; liquidoMs: number } {
  if (entrada.requisicoes <= 0) throw new RangeError('requisicoes');
  const bruto = (entrada.cpuDepoisMs - entrada.cpuAntesMs) / entrada.requisicoes;
  return { brutoMs: bruto, liquidoMs: Math.max(0, bruto - (entrada.referenciaMs ?? 0)) };
}

/** Lê o `utime + stime` de `/proc/<pid>/stat` (Linux), em ms. Os campos 14 e 15 vêm depois do nome entre parênteses. */
export function cpuDoProcStat(stat: string, ticksPorSegundo = 100): number {
  const resto = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  // resto[0] é o campo 3 (estado): utime é o 14 e stime o 15.
  const utime = Number(resto[11]);
  const stime = Number(resto[12]);
  return ((utime + stime) / ticksPorSegundo) * 1000;
}

function cpuDoProcessoMs(pid: number): number {
  if (process.platform === 'win32') {
    const saida = execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).TotalProcessorTime.TotalMilliseconds`],
      { encoding: 'utf8' },
    );
    return Number(saida.trim().replace(',', '.'));
  }
  return cpuDoProcStat(readFileSync(`/proc/${pid}/stat`, 'utf8'));
}

const cpuTotalMs = (pids: readonly number[]) => pids.reduce((s, p) => s + cpuDoProcessoMs(p), 0);

async function principal(): Promise<void> {
  const cookie = process.env['MASSA_COOKIE'];
  const pids = (process.env['WORKERD_PIDS'] ?? '').split(',').filter(Boolean).map(Number);
  if (!cookie || pids.length === 0) throw new Error('Defina MASSA_COOKIE e WORKERD_PIDS.');
  const base = process.env['URL_WORKER'] ?? 'http://127.0.0.1:8787';
  const n = Number(process.env['REPETICOES'] ?? 100);
  const rotas = process.argv.slice(2).length
    ? process.argv.slice(2)
    : [
        '/api/resumo',
        '/api/resumo?mes=2026-01-01',
        '/api/lancamentos?mes=2026-10-01',
        '/api/fixas/ocorrencias?mes=2026-10-01',
        '/api/formas',
        '/api/contas',
      ];
  const medir = async (rota: string, comCookie: boolean) => {
    const pedir = async () => {
      const r = await fetch(`${base}${rota}`, { headers: comCookie ? { Cookie: cookie } : {} });
      await r.arrayBuffer();
      return r.status;
    };
    for (let i = 0; i < 5; i++) await pedir(); // aquecimento
    const antes = cpuTotalMs(pids);
    let status = 0;
    for (let i = 0; i < n; i++) status = await pedir();
    return { status, antes, depois: cpuTotalMs(pids) };
  };

  const ref = await medir('/api/health', false);
  const referenciaMs = cpuPorRequisicao({ cpuAntesMs: ref.antes, cpuDepoisMs: ref.depois, requisicoes: n }).brutoMs;
  console.log(`referência /api/health (sem banco): ${referenciaMs.toFixed(2)} ms de CPU por requisição (n = ${n})`);
  console.log('rota | status | CPU bruta média (ms) | CPU líquida média (ms, − health)');
  for (const rota of rotas) {
    const m = await medir(rota, true);
    const r = cpuPorRequisicao({ cpuAntesMs: m.antes, cpuDepoisMs: m.depois, requisicoes: n, referenciaMs });
    console.log(`${rota} | ${m.status} | ${r.brutoMs.toFixed(2)} | ${r.liquidoMs.toFixed(2)}`);
  }
}

if (import.meta.main) {
  principal().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : 'Erro na medição.');
    process.exit(1);
  });
}
