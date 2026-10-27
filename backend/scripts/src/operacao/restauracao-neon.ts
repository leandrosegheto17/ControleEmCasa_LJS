/**
 * Ponto de restauração antes da migração (etapa 16; PLANO "branch de restauração no Neon mantendo 2"; G-43; TM-DB-07;
 * ADR-015). Passo do `.github/workflows/deploy.yml`, depois do build e antes do dump e da migração:
 *
 * 1. lista as branches do projeto e acha a principal (`main`, criada na etapa 17); sem ela, falha fechado;
 * 2. cria `restauracao-<run_id>-<tentativa>` a partir dela (cópia do instante, sem compute) e espera as operações do
 *    Neon terminarem; operação com falha derruba o passo;
 * 3. apaga as branches `restauracao-*` mais antigas, mantendo só as 2 mais novas (a criada agora e a anterior). Nunca
 *    apaga a principal, a padrão, uma protegida nem branch com outro nome.
 *
 * A chave da API vem só do ambiente (`NEON_API_KEY`, secret do environment `producao`) e nunca vai a argv nem ao log;
 * as mensagens de erro não ecoam corpo de resposta. Qualquer falha sai com código 1 e para o deploy.
 */

export const API_NEON = 'https://console.neon.tech/api/v2';
export const PREFIXO = 'restauracao-';
export const MANTER = 2;

export interface BranchNeon {
  id: string;
  name: string;
  created_at: string;
  default?: boolean;
  protected?: boolean;
}

interface OperacaoNeon {
  id: string;
  status: string;
}

export interface OpcoesRestauracao {
  apiKey: string;
  projetoId: string;
  /** Nome da branch nova; precisa seguir `restauracao-<run_id>-<tentativa>`. */
  nome: string;
  principal?: string;
  manter?: number;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  /** Tentativas por chamada que o Neon recusa por haver operação em andamento (423). */
  tentativas?: number;
}

export interface ResultadoRestauracao {
  criada: string;
  apagadas: string[];
}

const CHAVE_VALIDA = /^[A-Za-z0-9_-]+$/;
const PROJETO_VALIDO = /^[a-z0-9-]+$/;
const NOME_VALIDO = /^restauracao-\d+-\d+$/;

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

/** Lê a lista de GET /projects/{id}/branches. Formato inesperado lança (sem ecoar o corpo). */
export function lerBranches(corpo: unknown): BranchNeon[] {
  const branches = objeto(corpo)?.['branches'];
  if (!Array.isArray(branches)) throw new Error('Resposta do Neon sem a lista de branches.');
  return branches.map((b) => {
    const branch = objeto(b);
    if (
      typeof branch?.['id'] !== 'string' ||
      typeof branch['name'] !== 'string' ||
      typeof branch['created_at'] !== 'string' ||
      Number.isNaN(Date.parse(branch['created_at']))
    ) {
      throw new Error('Branch do Neon fora do formato esperado (id, name, created_at).');
    }
    return branch as unknown as BranchNeon;
  });
}

/** A branch principal pelo nome exato. Ausente ou repetida: lança (falha fechado). */
export function branchPrincipal(branches: readonly BranchNeon[], nome: string): BranchNeon {
  const achadas = branches.filter((b) => b.name === nome);
  if (achadas.length !== 1) throw new Error(`Branch principal "${nome}" não encontrada (ou repetida) no Neon.`);
  return achadas[0]!;
}

/**
 * Ids das branches de restauração a apagar: todas com o prefixo `restauracao-`, menos as `manter` mais novas por
 * `created_at`. A padrão, as protegidas e a principal nunca entram, mesmo com o prefixo.
 */
export function branchesAPodar(branches: readonly BranchNeon[], manter = MANTER, principal = 'main'): string[] {
  if (!Number.isInteger(manter) || manter < 1) throw new Error('É preciso manter ao menos 1 branch de restauração.');
  return branches
    .filter((b) => b.name.startsWith(PREFIXO) && !b.default && !b.protected && b.name !== principal)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(manter)
    .map((b) => b.id);
}

export async function criarPontoDeRestauracao(opcoes: OpcoesRestauracao): Promise<ResultadoRestauracao> {
  const {
    apiKey,
    projetoId,
    nome,
    principal = 'main',
    manter = MANTER,
    fetch: buscar = fetch,
    esperar = (ms) => new Promise((r) => setTimeout(r, ms)),
    tentativas = 10,
  } = opcoes;
  if (!CHAVE_VALIDA.test(apiKey)) throw new Error('NEON_API_KEY ausente ou fora do formato.');
  if (!PROJETO_VALIDO.test(projetoId)) throw new Error('NEON_PROJECT_ID ausente ou fora do formato.');
  if (!NOME_VALIDO.test(nome))
    throw new Error('Nome da branch de restauração fora do formato restauracao-<run>-<tentativa>.');

  const base = `${API_NEON}/projects/${projetoId}`;
  async function chamar(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
    for (let i = 1; ; i += 1) {
      const resposta = await buscar(`${base}${caminho}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      });
      // 423: o Neon ainda executa outra operação no projeto (ex.: a criação da branch). Espera e tenta de novo.
      if (resposta.status === 423 && i < tentativas) {
        await esperar(3_000);
        continue;
      }
      if (!resposta.ok) throw new Error(`Neon respondeu ${resposta.status} em ${metodo} ${caminho.split('/')[1]}.`);
      return resposta.status === 204 ? null : resposta.json();
    }
  }

  async function aguardarOperacoes(corpo: unknown): Promise<void> {
    const operacoes = objeto(corpo)?.['operations'];
    if (!Array.isArray(operacoes)) return;
    for (const op of operacoes as OperacaoNeon[]) {
      if (typeof op?.id !== 'string') throw new Error('Operação do Neon sem id.');
      for (let i = 0; ; i += 1) {
        const atual = objeto(objeto(await chamar('GET', `/operations/${op.id}`))?.['operation']);
        const status = atual?.['status'];
        if (status === 'finished' || status === 'skipped') break;
        if (status === 'failed' || status === 'error' || status === 'cancelled') {
          throw new Error(`Operação do Neon terminou com "${String(status)}".`);
        }
        if (i >= 60) throw new Error('Operação do Neon não terminou a tempo.');
        await esperar(2_000);
      }
    }
  }

  const antes = lerBranches(await chamar('GET', '/branches'));
  const pai = branchPrincipal(antes, principal);
  const criada = await chamar('POST', '/branches', { branch: { name: nome, parent_id: pai.id } });
  await aguardarOperacoes(criada);

  const depois = lerBranches(await chamar('GET', '/branches'));
  if (!depois.some((b) => b.name === nome))
    throw new Error('A branch de restauração não aparece no Neon depois de criada.');
  const apagar = branchesAPodar(depois, manter, principal);
  for (const id of apagar) {
    await aguardarOperacoes(await chamar('DELETE', `/branches/${id}`));
  }
  return { criada: nome, apagadas: apagar };
}

/** Nome da branch a partir do run do GitHub Actions (único por execução e por nova tentativa). */
export function nomeDaRestauracao(ambiente: NodeJS.ProcessEnv): string {
  const run = ambiente['GITHUB_RUN_ID'] ?? '';
  const tentativa = ambiente['GITHUB_RUN_ATTEMPT'] ?? '';
  return `${PREFIXO}${run}-${tentativa}`;
}

export async function main(ambiente: NodeJS.ProcessEnv = process.env, buscar: typeof fetch = fetch): Promise<number> {
  try {
    const r = await criarPontoDeRestauracao({
      apiKey: ambiente['NEON_API_KEY'] ?? '',
      projetoId: ambiente['NEON_PROJECT_ID'] ?? '',
      nome: nomeDaRestauracao(ambiente),
      fetch: buscar,
    });
    console.info(`Branch de restauração criada: ${r.criada}; antigas apagadas: ${r.apagadas.length}.`);
    return 0;
  } catch (erro) {
    console.error((erro as Error).message);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
