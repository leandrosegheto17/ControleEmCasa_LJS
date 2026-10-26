import type { SaidaLinhaCategorias, SaidaLinhaContas, SaidaLinhaFormasPagamento } from '@controle/contrato';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { encerrarNoAparelho } from '../../src/dados/sessao';
import { rotas } from '../../src/rotas';

/**
 * As telas entram por `lazy` e o contrato por import dinâmico: na primeira montagem, com a suíte inteira rodando em paralelo, a
 * transformação do módulo pode passar de 1 s e estourar o `findBy*`. Carregar antes, em `beforeAll`, tira isso do caminho.
 */
export const preAquecerPaginas = () =>
  Promise.all([
    // O transporte confere a resposta com o contrato por import dinâmico (só em teste e desenvolvimento).
    import('@controle/contrato'),
    import('../../src/paginas/Ajustes'),
    import('../../src/paginas/Contas'),
    import('../../src/paginas/Conta'),
    import('../../src/paginas/FormasPagamento'),
    import('../../src/paginas/FormaPagamento'),
    import('../../src/paginas/Categorias'),
    import('../../src/paginas/Categoria'),
    import('../../src/paginas/Lancamentos'),
    import('../../src/paginas/Lancamento'),
  ]);

/** Esquece o dono lembrado e a fila do aparelho: cada teste começa sem estado de outro. */
export const limparAparelho = encerrarNoAparelho;

/**
 * API simulada no `fetch` para as telas de cadastro (contas, formas, categorias): guarda o estado em memória e
 * registra cada chamada. O transporte, os ganchos e as páginas são os de verdade; só a rede é simulada.
 * As respostas seguem o contrato (`backend/contrato`, SDD 6.1 #5 a #19), nunca o código das telas.
 */

export const ID_USUARIO = '00000000-0000-4000-8000-0000000000a1';
export const ID_LAR = '00000000-0000-4000-8000-0000000000b1';
export const ID_NUBANK = '00000000-0000-4000-8000-000000000201';
export const ID_INTER = '00000000-0000-4000-8000-000000000202';
export const ID_PIX = '00000000-0000-4000-8000-000000000301';
export const ID_NUBANK_CREDITO = '00000000-0000-4000-8000-000000000302';
export const ID_MERCADO = '00000000-0000-4000-8000-000000000401';
export const ID_SALARIO = '00000000-0000-4000-8000-000000000402';
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface Chamada {
  metodo: string;
  url: string;
  corpo?: Record<string, unknown>;
  cabecalhos: Record<string, string>;
}

export interface Servidor {
  logado: boolean;
  semRede: boolean;
  contas: SaidaLinhaContas[];
  formas: SaidaLinhaFormasPagamento[];
  categorias: SaidaLinhaCategorias[];
  chamadas: Chamada[];
  /** Resposta de erro forçada para "METODO /api/recurso/:id/acao" (o id vira `:id`). */
  erros: Map<string, { status: number; code: string }>;
  /** Plano efetivo que `GET /api/sessao` devolve (etapa 13); sem valor, `null` como antes. */
  plano?: 'free' | 'pro' | null;
}

export const conta = (parcial: Partial<SaidaLinhaContas> = {}): SaidaLinhaContas => ({
  id: ID_NUBANK,
  nome: 'Nubank',
  saldo_inicial_centavos: 250000,
  saldo_centavos: 321485,
  arquivada: false,
  pode_excluir: false,
  ...parcial,
});

export const forma = (parcial: Partial<SaidaLinhaFormasPagamento> = {}): SaidaLinhaFormasPagamento => ({
  id: ID_PIX,
  nome: 'Pix Nubank',
  tipo: 'pix',
  conta: { id: ID_NUBANK, nome: 'Nubank' },
  dia_vencimento: null,
  preferida: false,
  arquivada: false,
  pode_excluir: false,
  gasto_mes_centavos: null,
  comprometido_futuro_centavos: null,
  ...parcial,
});

export const cartao = (parcial: Partial<SaidaLinhaFormasPagamento> = {}): SaidaLinhaFormasPagamento =>
  forma({
    id: ID_NUBANK_CREDITO,
    nome: 'Nubank Crédito',
    tipo: 'credito',
    conta: { id: ID_NUBANK, nome: 'Nubank' },
    dia_vencimento: 10,
    gasto_mes_centavos: 123456,
    comprometido_futuro_centavos: 40000,
    ...parcial,
  });

export const categoria = (parcial: Partial<SaidaLinhaCategorias> = {}): SaidaLinhaCategorias => ({
  id: ID_MERCADO,
  nome: 'Mercado',
  tipo: 'despesa',
  escopo: 'conjunto',
  variavel: true,
  arquivada: false,
  pode_excluir: false,
  ...parcial,
});

export function criarServidor(parcial: Partial<Servidor> = {}): Servidor {
  return {
    logado: true,
    semRede: false,
    contas: [conta(), conta({ id: ID_INTER, nome: 'Inter', saldo_inicial_centavos: 0, saldo_centavos: 5000 })],
    formas: [forma(), cartao()],
    categorias: [
      categoria(),
      categoria({ id: ID_SALARIO, nome: 'Salário', tipo: 'receita', escopo: 'individual', variavel: null }),
    ],
    chamadas: [],
    erros: new Map(),
    ...parcial,
  };
}

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
export const semCorpo = () => new Response(null, { status: 204 });

export function sessao(plano: 'free' | 'pro' | null = null) {
  return {
    usuario: { id: ID_USUARIO, nome: 'Ana', email: 'ana@exemplo.com' },
    membro: { id: ID_USUARIO, nome: 'Ana', papel: 'titular' },
    lar: { id: ID_LAR, nome: 'Casa' },
    plano,
    termos_pendentes: false,
  };
}

type Recurso = 'contas' | 'formas' | 'categorias';
type Corpo = Record<string, unknown> | undefined;
type Registro = { id: string; arquivada: boolean; pode_excluir: boolean };

function novo(recurso: Recurso, id: string, c: Record<string, unknown>) {
  if (recurso === 'contas') {
    const saldo = Number(c.saldo_inicial_centavos ?? 0);
    return conta({
      id,
      nome: String(c.nome),
      saldo_inicial_centavos: saldo,
      saldo_centavos: saldo,
      pode_excluir: true,
    });
  }
  if (recurso === 'formas') {
    return forma({
      id,
      nome: String(c.nome),
      tipo: c.tipo as 'pix',
      dia_vencimento: (c.dia_vencimento as number | null) ?? null,
      conta: null,
      pode_excluir: true,
    });
  }
  return categoria({
    id,
    nome: String(c.nome),
    tipo: c.tipo as 'despesa',
    escopo: c.escopo as 'conjunto',
    variavel: (c.variavel as boolean | null | undefined) ?? null,
    pode_excluir: true,
  });
}

function atualizacao(recurso: Recurso, c: Record<string, unknown>) {
  if (recurso === 'contas') {
    return { nome: String(c.nome), saldo_inicial_centavos: Number(c.saldo_inicial_centavos ?? 0) };
  }
  if (recurso === 'formas')
    return { nome: String(c.nome), dia_vencimento: (c.dia_vencimento as number | null) ?? null };
  return { nome: String(c.nome) };
}

export function responder(s: Servidor, metodo: string, url: string, corpo: Corpo): Response {
  if (url === '/api/sessao' && metodo === 'GET') {
    return s.logado ? json(sessao(s.plano ?? null)) : json({ code: 'sessao_expirada', message: 'x' }, 401);
  }
  if (url === '/api/sessao/sair' || url === '/api/sessao/sair-de-todos') {
    s.logado = false;
    return semCorpo();
  }
  const m = /^\/api\/(contas|formas|categorias)(?:\/([^/]+))?(?:\/([a-z-]+))?$/.exec(url);
  if (!m) return json({ code: 'rota_inexistente', message: 'x' }, 404);
  const recurso = m[1] as Recurso;
  const id = m[2];
  const acao = m[3];

  const chave = `${metodo} /api/${recurso}${id ? '/:id' : ''}${acao ? `/${acao}` : ''}`;
  const forcado = s.erros.get(chave);
  if (forcado) return json({ code: forcado.code, message: 'x' }, forcado.status);

  const lista = s[recurso] as unknown as Registro[];
  if (!id) return metodo === 'GET' ? json(lista) : json({ code: 'rota_inexistente', message: 'x' }, 404);
  const existente = lista.find((r) => r.id === id);

  if (metodo === 'PUT' && !acao) {
    if (existente) Object.assign(existente, atualizacao(recurso, corpo ?? {}));
    else lista.push(novo(recurso, id, corpo ?? {}) as unknown as Registro);
    return json({ id }, existente ? 200 : 201);
  }
  if (!existente) return json({ code: 'registro_invalido', message: 'x' }, 404);
  if (metodo === 'PUT' && acao === 'preferida') {
    (existente as unknown as SaidaLinhaFormasPagamento).preferida = corpo?.preferida === true;
    return semCorpo();
  }
  if (metodo === 'POST' && acao === 'arquivar') {
    existente.arquivada = true;
    return semCorpo();
  }
  if (metodo === 'POST' && acao === 'ajuste') {
    const c = existente as unknown as SaidaLinhaContas;
    const diferenca = Number(corpo?.saldo_real_centavos) - c.saldo_centavos;
    if (corpo?.simular !== true) c.saldo_centavos += diferenca;
    return json({ diferenca_centavos: diferenca });
  }
  if (metodo === 'POST' && acao === 'pagamentos') return json({ id: String(corpo?.id), ja_existia: false }, 201);
  if (metodo === 'DELETE') {
    if (!existente.pode_excluir) {
      return json({ code: recurso === 'categorias' ? 'categoria_em_uso' : 'em_uso', message: 'x' }, 409);
    }
    lista.splice(lista.indexOf(existente), 1);
    return semCorpo();
  }
  return json({ code: 'rota_inexistente', message: 'x' }, 404);
}

/** Troca o `fetch` global pelo simulado. Quem chama desfaz com `vi.unstubAllGlobals()`. */
export function instalarApi(s: Servidor): void {
  const simulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    s.chamadas.push({ metodo, url, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> });
    if (s.semRede) throw new TypeError('Failed to fetch');
    return responder(s, metodo, url, corpo);
  });
  vi.stubGlobal('fetch', simulado);
}

/** Chamadas de escrita (tudo que não é GET), para conferir o que a tela enviou. */
export const escritas = (s: Servidor) => s.chamadas.filter((c) => c.metodo !== 'GET');

/** Monta o app inteiro (rotas, guardas, moldura) no caminho dado, contra o servidor simulado. */
export function montarApp(caminho: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const roteador = createMemoryRouter(rotas, { initialEntries: [caminho] });
  const tela = render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>,
  );
  const local = () => `${roteador.state.location.pathname}${roteador.state.location.search}`;
  return { roteador, cliente, local, ...tela };
}
