import type {
  SaidaDadosLancamento,
  SaidaItemLancamentoMes,
  SaidaLancamento,
  SaidaLancamentoDoOutroMembro,
  SaidaLancamentoDoPagador,
  SaidaResumoMes,
} from '@controle/contrato';
import { vi } from 'vitest';
import { lerResposta } from './fetchSimulado';
import { criarServidor, ID_USUARIO, json, responder, semCorpo, type Servidor } from './apiCadastros';

/**
 * API simulada dos lançamentos, do resumo e da fila, por cima da dos cadastros (`apiCadastros.tsx`): estado em memória,
 * cada chamada registrada, respostas no formato do contrato (`backend/contrato`, SDD 6.1 #4, #20 a #26 e #33).
 * As regras que o servidor decide (permissão, descarte de ajustes) seguem o critério de aceite (RN-04, RN-06, RN-07),
 * nunca o código das telas; o transporte, os ganchos e as páginas são os de verdade.
 */

export const ID_OUTRO_MEMBRO = '00000000-0000-4000-8000-000000000102';
export const ID_LANCAMENTO_PAGADOR = '00000000-0000-4000-8000-000000000520';
export const ID_LANCAMENTO_DO_OUTRO = '00000000-0000-4000-8000-000000000521';
export const ID_PARCELA_AJUSTADA = '00000000-0000-4000-8000-000000000622';
export const ID_PARCELA_1 = '00000000-0000-4000-8000-000000000620';
export const ID_CARTAO_XP = '00000000-0000-4000-8000-000000000303';

export interface ServidorLancamentos extends Servidor {
  dados: SaidaDadosLancamento;
  /** Detalhes por id; a forma (pagador ou outro membro) é a que o servidor devolveria a quem pede. */
  detalhes: Map<string, SaidaLancamento>;
  itensMes: SaidaItemLancamentoMes[];
  resumo: SaidaResumoMes;
  /** Erros forçados por "METODO /api/rota" (caminho com `:id`). */
  falhas: Map<string, { status: number; code: string }>;
  /** Atraso (ms) de uma rota "METODO /api/rota", para observar o estado de carregamento. */
  atrasos: Map<string, number>;
}

const comoUsuario = <T,>(valor: T): T =>
  JSON.parse(JSON.stringify(valor).replaceAll('00000000-0000-4000-8000-000000000101', ID_USUARIO)) as T;

/** Lançamento do pagador (a sessão simulada), com `pagamento` e `data_ajustada` (CA-04.1). */
export const detalheDoPagador = (): SaidaLancamentoDoPagador =>
  comoUsuario(lerResposta<SaidaLancamentoDoPagador>('lancamento-pagador.json'));

/** Lançamento do outro membro: as chaves privadas NÃO EXISTEM (RN-04, G-11). */
export const detalheDoOutro = (): SaidaLancamentoDoOutroMembro => {
  const base = lerResposta<SaidaLancamentoDoOutroMembro>('lancamento-outro-membro.json');
  return { ...base, id: ID_LANCAMENTO_DO_OUTRO, pagador: { ...base.pagador, id: ID_OUTRO_MEMBRO } };
};

export function criarServidorLancamentos(parcial: Partial<ServidorLancamentos> = {}): ServidorLancamentos {
  const dados = lerResposta<SaidaDadosLancamento>('dados-lancamento.json');
  const base = criarServidor();
  return {
    ...base,
    dados,
    detalhes: new Map<string, SaidaLancamento>([
      [ID_LANCAMENTO_PAGADOR, detalheDoPagador()],
      [ID_LANCAMENTO_DO_OUTRO, detalheDoOutro()],
    ]),
    itensMes: comoUsuario(lerResposta<{ itens: SaidaItemLancamentoMes[] }>('lancamentos-mes.json').itens),
    resumo: comoUsuario(lerResposta<SaidaResumoMes>('resumo-mes.json')),
    falhas: new Map(),
    atrasos: new Map(),
    ...parcial,
  };
}

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

const somar = (a: string, meses: number) => {
  const [ano, mes, dia] = a.split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(ano, mes - 1 + meses, dia));
  return d.toISOString().slice(0, 10);
};

function listar(s: ServidorLancamentos, busca: URLSearchParams) {
  const mes = (busca.get('mes') ?? '').slice(0, 7);
  const escopo = busca.get('escopo');
  const categoria = busca.get('categoria_id');
  const variavel = busca.get('variavel');
  const itens = s.itensMes.filter(
    (i) =>
      i.data.startsWith(mes) &&
      (escopo === null || i.escopo === escopo) &&
      (categoria === null || i.categoria.id === categoria) &&
      (variavel === null || i.categoria.variavel === (variavel === 'true')),
  );
  return {
    mes: `${mes}-01`,
    filtros: {
      escopo: (escopo as 'conjunto' | 'individual' | null) ?? null,
      categoria_id: categoria,
      forma_id: busca.get('forma_id'),
      variavel: variavel === null ? null : variavel === 'true',
    },
    total_filtrado_centavos: itens.filter((i) => i.tipo === 'despesa').reduce((t, i) => t + i.valor_centavos, 0),
    quantidade: itens.length,
    itens,
  };
}

type Corpo = Record<string, unknown> | undefined;

function lancar(s: ServidorLancamentos, tipo: 'despesa' | 'receita', corpo: Corpo): Response {
  const id = String(corpo?.id);
  const existente = s.detalhes.get(id);
  const categorias = tipo === 'despesa' ? s.dados.categorias_despesa : s.dados.categorias_receita;
  const categoria = categorias.find((c) => c.id === corpo?.categoria_id);
  const valor = Number(corpo?.valor_centavos);
  if (existente) {
    return json(
      {
        id,
        escopo: existente.escopo,
        categoria: existente.categoria.nome,
        valor_total_centavos: existente.valor_total_centavos,
        num_parcelas: existente.num_parcelas,
        primeira_parcela_data: existente.parcelas[0]!.data,
        ja_existia: true,
      },
      200,
    );
  }
  if (!categoria) return json({ code: 'registro_invalido', message: 'x' }, 404);
  if (!Number.isInteger(valor) || valor <= 0) return json({ code: 'valor_invalido', message: 'x' }, 400);
  const parcelas = tipo === 'despesa' ? Number(corpo?.parcelas ?? 1) : 1;
  const data = typeof corpo?.data === 'string' ? corpo.data : '2026-10-12';
  const cada = Math.floor(valor / parcelas);
  const forma = s.dados.formas.find((f) => f.id === corpo?.forma_id);
  const detalhe: SaidaLancamentoDoPagador = {
    id,
    tipo,
    escopo: categoria.escopo,
    descricao: typeof corpo?.descricao === 'string' && corpo.descricao ? corpo.descricao : null,
    categoria: { id: categoria.id, nome: categoria.nome, escopo: categoria.escopo },
    valor_total_centavos: valor,
    num_parcelas: parcelas,
    pagador: { id: ID_USUARIO, nome: 'Ana', sou_eu: true },
    alterado_por: null,
    alterado_em: null,
    parcela_em_foco: 1,
    parcelas: Array.from({ length: parcelas }, (_, i) => ({
      id: `00000000-0000-4000-8000-0000000007${String(i).padStart(2, '0')}`,
      numero: i + 1,
      valor_centavos: i === parcelas - 1 ? valor - cada * (parcelas - 1) : cada,
      data: somar(data, i),
      data_ajustada: false,
    })),
    pagamento: {
      forma: forma ? { id: forma.id, nome: forma.nome, tipo: forma.tipo } : null,
      conta: null,
      data_operacao: data,
      dia_vencimento_aplicado: null,
    },
  };
  s.detalhes.set(id, detalhe);
  return json(
    {
      id,
      escopo: detalhe.escopo,
      categoria: categoria.nome,
      valor_total_centavos: valor,
      num_parcelas: parcelas,
      primeira_parcela_data: detalhe.parcelas[0]!.data,
      ja_existia: false,
    },
    201,
  );
}

/** PATCH do lançamento, pelas regras de RN-06 e RN-07 (quem altera o quê) e CA-06.4 (descarte de ajustes). */
function editar(s: ServidorLancamentos, id: string, corpo: Corpo): Response {
  const detalhe = s.detalhes.get(id);
  if (!detalhe) return json({ code: 'registro_invalido', message: 'x' }, 404);
  const doPagador = 'pagamento' in detalhe;
  const privados = ['data', 'forma_id', 'num_parcelas'];
  if (!doPagador && privados.some((c) => corpo?.[c] !== undefined && corpo[c] !== null)) {
    return json({ code: 'sem_permissao', message: 'x' }, 403);
  }
  if (doPagador) {
    const recalcula = ['valor_total_centavos', 'num_parcelas', 'data', 'forma_id'].some(
      (c) => corpo?.[c] !== undefined && corpo[c] !== null,
    );
    const ajustada = detalhe.parcelas.some((p) => 'data_ajustada' in p && p.data_ajustada);
    if (recalcula && ajustada && corpo?.confirmar_descarte !== true) {
      return json({ code: 'confirmar_descarte_ajustes', message: 'x' }, 409);
    }
    if (recalcula && 'data_ajustada' in detalhe.parcelas[0]!) {
      for (const p of detalhe.parcelas) (p as unknown as { data_ajustada: boolean }).data_ajustada = false;
    }
  }
  if (typeof corpo?.valor_total_centavos === 'number') detalhe.valor_total_centavos = corpo.valor_total_centavos;
  if (typeof corpo?.descricao === 'string') detalhe.descricao = corpo.descricao.trim() === '' ? null : corpo.descricao;
  if (typeof corpo?.num_parcelas === 'number') detalhe.num_parcelas = corpo.num_parcelas;
  return json({ id, escopo: detalhe.escopo, num_parcelas: detalhe.num_parcelas, alterado_em: '2026-10-12T15:00:00Z' });
}

/** Só o pagador, só crédito (CA-06.7); o resto é `sem_permissao` ou `registro_invalido`. */
function alterarParcela(s: ServidorLancamentos, id: string, corpo: Corpo): Response {
  for (const detalhe of s.detalhes.values()) {
    const parcela = detalhe.parcelas.find((p) => p.id === id);
    if (!parcela) continue;
    if (!('pagamento' in detalhe)) return json({ code: 'sem_permissao', message: 'x' }, 403);
    if (detalhe.pagamento.forma?.tipo !== 'credito') return json({ code: 'sem_permissao', message: 'x' }, 403);
    if (typeof corpo?.data !== 'string' || corpo.data === '')
      return json({ code: 'valor_invalido', message: 'x' }, 400);
    parcela.data = corpo.data;
    (parcela as unknown as { data_ajustada: boolean }).data_ajustada = true;
    return semCorpo();
  }
  return json({ code: 'registro_invalido', message: 'x' }, 404);
}

async function atender(s: ServidorLancamentos, metodo: string, url: string, corpo: Corpo): Promise<Response> {
  const alvo = new URL(url, 'http://x');
  const caminho = alvo.pathname;
  const chave = `${metodo} ${caminho.replace(/\/[0-9a-f-]{36}(?=\/|$)/g, '/:id')}`;
  const atraso = s.atrasos.get(chave);
  if (atraso) await dormir(atraso);
  const falha = s.falhas.get(chave);
  if (falha) return json({ code: falha.code, message: 'x' }, falha.status);

  if (caminho === '/api/lancamentos/dados' && metodo === 'GET') return json(s.dados);
  if (caminho === '/api/lancamentos' && metodo === 'GET') return json(listar(s, alvo.searchParams));
  if (caminho === '/api/lancamentos/despesas' && metodo === 'POST') return lancar(s, 'despesa', corpo);
  if (caminho === '/api/lancamentos/receitas' && metodo === 'POST') return lancar(s, 'receita', corpo);
  if (caminho === '/api/resumo' && metodo === 'GET') return json(s.resumo);
  const l = /^\/api\/lancamentos\/([^/]+)$/.exec(caminho);
  if (l) {
    const id = l[1]!;
    if (metodo === 'GET') {
      const d = s.detalhes.get(id);
      return d ? json(d) : json({ code: 'registro_invalido', message: 'x' }, 404);
    }
    if (metodo === 'PATCH') return editar(s, id, corpo);
    if (metodo === 'DELETE') {
      if (!s.detalhes.delete(id)) return json({ code: 'registro_invalido', message: 'x' }, 404);
      return semCorpo();
    }
  }
  const p = /^\/api\/parcelas\/([^/]+)$/.exec(caminho);
  if (p && metodo === 'PATCH') return alterarParcela(s, p[1]!, corpo);
  return responder(s, metodo, url, corpo);
}

/** Troca o `fetch` global pelo simulado. Quem chama desfaz com `vi.unstubAllGlobals()`. */
export function instalarApiLancamentos(s: ServidorLancamentos): void {
  const simulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    s.chamadas.push({ metodo, url, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> });
    if (s.semRede) throw new TypeError('Failed to fetch');
    return atender(s, metodo, url, corpo);
  });
  vi.stubGlobal('fetch', simulado);
}

/** Chamadas feitas a uma rota (método + caminho com query), para conferir o que a tela enviou. */
export const chamadasA = (s: Servidor, metodo: string, prefixo: string) =>
  s.chamadas.filter((c) => c.metodo === metodo && c.url.startsWith(prefixo));
