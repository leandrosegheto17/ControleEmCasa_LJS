import { describe, expect, it, vi } from 'vitest';
import {
  API_NEON,
  branchesAPodar,
  branchPrincipal,
  criarPontoDeRestauracao,
  lerBranches,
  main,
  nomeDaRestauracao,
  type BranchNeon,
} from './restauracao-neon';

/**
 * Branch de restauração no Neon antes da migração, mantendo as 2 mais novas (PLANO etapa 16; G-43; TM-DB-07;
 * ADR-015). Sem rede: o `fetch` é simulado com um Neon em memória.
 */

const CHAVE = 'napi_chave-de-teste_123';
const PROJETO = 'projeto-teste-123';

function branch(id: string, name: string, created_at: string, extra: Partial<BranchNeon> = {}): BranchNeon {
  return { id, name, created_at, ...extra };
}

interface Chamada {
  metodo: string;
  url: string;
  corpo?: unknown;
  autorizacao?: string;
}

/** Neon simulado: guarda branches e operações; `falhas` força status por (método + caminho). */
function neonFalso(inicial: BranchNeon[], opcoes: { status423?: number; operacao?: string; falhaEm?: string } = {}) {
  const branches = [...inicial];
  const chamadas: Chamada[] = [];
  let restantes423 = opcoes.status423 ?? 0;
  let seq = 0;
  const responder = (status: number, corpo?: unknown) =>
    new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const fetchFalso = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const cabecalhos = new Headers(init?.headers);
    const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    chamadas.push({ metodo, url, corpo, autorizacao: cabecalhos.get('Authorization') ?? undefined });
    const caminho = url.replace(`${API_NEON}/projects/${PROJETO}`, '');
    if (opcoes.falhaEm === `${metodo} ${caminho.split('/')[1]}`) return responder(500, { message: 'erro interno' });
    if (metodo === 'GET' && caminho === '/branches') return responder(200, { branches });
    if (metodo === 'POST' && caminho === '/branches') {
      seq += 1;
      const nova = branch(`br-nova-${seq}`, corpo.branch.name, '2026-10-27T12:00:00Z');
      branches.push(nova);
      return responder(201, { branch: nova, operations: [{ id: `op-${seq}`, status: 'running' }] });
    }
    if (metodo === 'DELETE' && caminho.startsWith('/branches/')) {
      if (restantes423 > 0) {
        restantes423 -= 1;
        return responder(423, { message: 'locked' });
      }
      const id = caminho.split('/')[2];
      const i = branches.findIndex((b) => b.id === id);
      branches.splice(i, 1);
      return responder(200, { branch: { id }, operations: [{ id: `op-del-${id}`, status: 'running' }] });
    }
    if (metodo === 'GET' && caminho.startsWith('/operations/')) {
      return responder(200, { operation: { id: caminho.split('/')[2], status: opcoes.operacao ?? 'finished' } });
    }
    return responder(404, {});
  });
  return { fetch: fetchFalso as unknown as typeof fetch, branches, chamadas };
}

const semEspera = async () => {};

describe('branchesAPodar', () => {
  const lista = [
    branch('br-main', 'main', '2026-01-01T00:00:00Z', { default: true }),
    branch('br-dev', 'dev', '2026-01-02T00:00:00Z'),
    branch('br-1', 'restauracao-1-1', '2026-10-01T00:00:00Z'),
    branch('br-3', 'restauracao-3-1', '2026-10-03T00:00:00Z'),
    branch('br-2', 'restauracao-2-1', '2026-10-02T00:00:00Z'),
    branch('br-4', 'restauracao-4-1', '2026-10-04T00:00:00Z'),
  ];

  it('mantém as 2 de restauração mais novas por created_at e devolve as demais', () => {
    expect(branchesAPodar(lista).sort()).toEqual(['br-1', 'br-2']);
  });

  it('com 2 ou menos de restauração, não apaga nada', () => {
    expect(branchesAPodar(lista.slice(0, 4))).toEqual([]);
  });

  it('nunca apaga a principal, a padrão, uma protegida nem branch com outro nome', () => {
    const perigosas = [
      branch('br-a', 'restauracao-velha-padrao', '2020-01-01T00:00:00Z', { default: true }),
      branch('br-b', 'restauracao-velha-protegida', '2020-01-01T00:00:00Z', { protected: true }),
      branch('br-c', 'restauracao-9-1', '2026-10-09T00:00:00Z'),
      branch('br-d', 'restauracao-8-1', '2026-10-08T00:00:00Z'),
      branch('br-e', 'backup-manual', '2019-01-01T00:00:00Z'),
    ];
    expect(branchesAPodar([...lista, ...perigosas]).sort()).toEqual(['br-1', 'br-2', 'br-3', 'br-4']);
  });

  it('recusa manter menos de 1', () => {
    expect(() => branchesAPodar(lista, 0)).toThrow();
  });
});

describe('lerBranches e branchPrincipal (falha fechado)', () => {
  it('recusa resposta sem lista ou com branch fora do formato, sem ecoar o corpo', () => {
    expect(() => lerBranches({})).toThrow(/sem a lista/);
    expect(() => lerBranches({ branches: [{ id: 'x', name: 'y' }] })).toThrow(/formato/);
    expect(() => lerBranches({ branches: [{ id: 'x', name: 'y', created_at: 'ontem' }] })).toThrow(/formato/);
    expect(() => lerBranches(null)).toThrow();
  });

  it('a principal precisa existir uma única vez', () => {
    expect(() => branchPrincipal([], 'main')).toThrow(/não encontrada/);
    const dup = [branch('a', 'main', '2026-01-01T00:00:00Z'), branch('b', 'main', '2026-01-02T00:00:00Z')];
    expect(() => branchPrincipal(dup, 'main')).toThrow();
    expect(branchPrincipal([dup[0]!], 'main').id).toBe('a');
  });
});

describe('criarPontoDeRestauracao', () => {
  const inicial = () => [
    branch('br-main', 'main', '2026-01-01T00:00:00Z', { default: true }),
    branch('br-1', 'restauracao-1-1', '2026-10-01T00:00:00Z'),
    branch('br-2', 'restauracao-2-1', '2026-10-02T00:00:00Z'),
  ];

  it('cria a branch a partir da main e deixa só as 2 mais novas (a nova e a anterior)', async () => {
    const neon = neonFalso(inicial());
    const r = await criarPontoDeRestauracao({
      apiKey: CHAVE,
      projetoId: PROJETO,
      nome: 'restauracao-77-1',
      fetch: neon.fetch,
      esperar: semEspera,
    });
    expect(r).toEqual({ criada: 'restauracao-77-1', apagadas: ['br-1'] });
    const post = neon.chamadas.find((c) => c.metodo === 'POST')!;
    expect(post.corpo).toEqual({ branch: { name: 'restauracao-77-1', parent_id: 'br-main' } });
    expect(neon.branches.map((b) => b.name).sort()).toEqual(['main', 'restauracao-2-1', 'restauracao-77-1']);
  });

  it('cria antes de apagar: nenhuma antiga sai se a criação falhar', async () => {
    const neon = neonFalso(inicial(), { falhaEm: 'POST branches' });
    await expect(
      criarPontoDeRestauracao({
        apiKey: CHAVE,
        projetoId: PROJETO,
        nome: 'restauracao-77-1',
        fetch: neon.fetch,
        esperar: semEspera,
      }),
    ).rejects.toThrow(/500/);
    expect(neon.chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);
    expect(neon.branches).toHaveLength(3);
  });

  it('operação do Neon com falha derruba o passo antes de apagar qualquer branch', async () => {
    const neon = neonFalso(inicial(), { operacao: 'failed' });
    await expect(
      criarPontoDeRestauracao({
        apiKey: CHAVE,
        projetoId: PROJETO,
        nome: 'restauracao-77-1',
        fetch: neon.fetch,
        esperar: semEspera,
      }),
    ).rejects.toThrow(/failed/);
    expect(neon.chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);
  });

  it('sem a branch main, falha fechado e não cria nada', async () => {
    const neon = neonFalso([branch('br-x', 'producao', '2026-01-01T00:00:00Z')]);
    await expect(
      criarPontoDeRestauracao({
        apiKey: CHAVE,
        projetoId: PROJETO,
        nome: 'restauracao-77-1',
        fetch: neon.fetch,
        esperar: semEspera,
      }),
    ).rejects.toThrow(/main/);
    expect(neon.chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('tenta de novo quando o Neon responde 423 (operação em andamento)', async () => {
    const neon = neonFalso(inicial(), { status423: 2 });
    const r = await criarPontoDeRestauracao({
      apiKey: CHAVE,
      projetoId: PROJETO,
      nome: 'restauracao-77-1',
      fetch: neon.fetch,
      esperar: semEspera,
    });
    expect(r.apagadas).toEqual(['br-1']);
    expect(neon.chamadas.filter((c) => c.metodo === 'DELETE')).toHaveLength(3);
  });

  it('a chave vai só no cabeçalho Authorization, nunca na URL', async () => {
    const neon = neonFalso(inicial());
    await criarPontoDeRestauracao({
      apiKey: CHAVE,
      projetoId: PROJETO,
      nome: 'restauracao-77-1',
      fetch: neon.fetch,
      esperar: semEspera,
    });
    for (const c of neon.chamadas) {
      expect(c.autorizacao).toBe(`Bearer ${CHAVE}`);
      expect(c.url).not.toContain(CHAVE);
      expect(c.url.startsWith(`${API_NEON}/projects/${PROJETO}/`)).toBe(true);
    }
  });

  it('valida chave, projeto e nome antes de qualquer chamada', async () => {
    const neon = neonFalso(inicial());
    const base = { apiKey: CHAVE, projetoId: PROJETO, nome: 'restauracao-77-1', fetch: neon.fetch, esperar: semEspera };
    await expect(criarPontoDeRestauracao({ ...base, apiKey: '' })).rejects.toThrow(/NEON_API_KEY/);
    await expect(criarPontoDeRestauracao({ ...base, apiKey: 'a"b\nc' })).rejects.toThrow(/NEON_API_KEY/);
    await expect(criarPontoDeRestauracao({ ...base, projetoId: '../x' })).rejects.toThrow(/NEON_PROJECT_ID/);
    await expect(criarPontoDeRestauracao({ ...base, nome: 'main' })).rejects.toThrow(/formato/);
    await expect(criarPontoDeRestauracao({ ...base, nome: 'restauracao--' })).rejects.toThrow(/formato/);
    expect(neon.chamadas).toHaveLength(0);
  });
});

describe('main (ponto de entrada do deploy.yml)', () => {
  it('monta o nome com o run e a tentativa do GitHub Actions', () => {
    expect(nomeDaRestauracao({ GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' })).toBe('restauracao-123-2');
  });

  it('sai com 0 no sucesso e 1 na falha, sem imprimir a chave', async () => {
    const erros: string[] = [];
    const infos: string[] = [];
    const espiaErro = vi.spyOn(console, 'error').mockImplementation((m: string) => void erros.push(String(m)));
    const espiaInfo = vi.spyOn(console, 'info').mockImplementation((m: string) => void infos.push(String(m)));
    try {
      const ok = neonFalso([branch('br-main', 'main', '2026-01-01T00:00:00Z')]);
      const amb = { NEON_API_KEY: CHAVE, NEON_PROJECT_ID: PROJETO, GITHUB_RUN_ID: '9', GITHUB_RUN_ATTEMPT: '1' };
      expect(await main(amb, ok.fetch)).toBe(0);
      const falha = neonFalso([branch('br-main', 'main', '2026-01-01T00:00:00Z')], { falhaEm: 'GET branches' });
      expect(await main(amb, falha.fetch)).toBe(1);
      expect(await main({ ...amb, NEON_API_KEY: undefined }, ok.fetch)).toBe(1);
    } finally {
      espiaErro.mockRestore();
      espiaInfo.mockRestore();
    }
    expect(infos.join('\n')).toContain('restauracao-9-1');
    for (const linha of [...erros, ...infos]) expect(linha).not.toContain(CHAVE);
    expect(erros).toHaveLength(2);
  });
});
