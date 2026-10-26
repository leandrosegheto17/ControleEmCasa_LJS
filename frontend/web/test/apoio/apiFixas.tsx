import type {
  SaidaLinhaCategorias,
  SaidaLinhaDespesasFixas,
  SaidaOcorrenciaMes,
  SaidaOrcamentoMes,
} from '@controle/contrato';
import { vi } from 'vitest';
import { categoria, ID_SALARIO, json, semCorpo } from './apiCadastros';
import { atender, criarServidorLancamentos, type ServidorLancamentos } from './apiLancamentos';
import { lerResposta } from './fetchSimulado';

/**
 * API simulada das despesas fixas, das ocorrências e do orçamento, por cima da dos lançamentos (`apiLancamentos.tsx`):
 * estado em memória, cada chamada registrada, respostas no formato do contrato (SDD 6.1 #27 a #36). As regras que o
 * servidor decide seguem o critério de aceite do PRD-TECNICO (RN-15, RN-16, CA-15.x), nunca o código das telas:
 * ocorrência atrasada (vencimento < hoje), ordem atrasadas > pendentes > pagas, pagar uma vez (CA-15.5), desfazer só
 * pelo pagador, situação do orçamento pela razão exata (realizado x 100 < orçado x 80), copiar sem sobrescrever (CA-16.7).
 */

export const ID_ALUGUEL = '00000000-0000-4000-8000-000000000701';
export const ID_CONDOMINIO = '00000000-0000-4000-8000-000000000702';
export const ID_OC_INTERNET = '00000000-0000-4000-8000-000000000804';
export const ID_OC_ALUGUEL = '00000000-0000-4000-8000-000000000801';
export const ID_OC_CONDOMINIO = '00000000-0000-4000-8000-000000000802';
export const ID_OC_LUZ = '00000000-0000-4000-8000-000000000803';
export const ID_OC_AGUA = '00000000-0000-4000-8000-000000000806';
export const ID_MORADIA = '00000000-0000-4000-8000-000000000403';
export const ID_CONTAS_CASA = '00000000-0000-4000-8000-000000000404';
export const ID_OUTROS_CASA = '00000000-0000-4000-8000-000000000405';
export const ID_DELIVERY_CASAL = '00000000-0000-4000-8000-000000000402';
export const ID_TRANSPORTE = '00000000-0000-4000-8000-000000000413';
export const ID_LAZER_PESSOAL = '00000000-0000-4000-8000-000000000414';
export const ID_PIX_NUBANK = '00000000-0000-4000-8000-000000000301';
export const ID_CARTAO_XP = '00000000-0000-4000-8000-000000000303';

type Escopo = 'conjunto' | 'individual';
type Corpo = Record<string, unknown> | undefined;

export interface PagamentoGravado {
  /** Id do lançamento de pagamento enviado pelo cliente (idempotência). */
  id: string;
  ocorrenciaId: string;
  formaId: string;
  data: string | null;
  valorCentavos: number;
}

export interface ServidorFixas extends ServidorLancamentos {
  modelos: SaidaLinhaDespesasFixas[];
  /** Todas as ocorrências já geradas, de qualquer mês. */
  ocorrencias: SaidaOcorrenciaMes[];
  /** Pagamentos feitos na sessão: forma e data NUNCA voltam nas respostas (§2.1). */
  pagamentos: PagamentoGravado[];
  /** Orçado por "AAAA-MM-01|categoria_id", por escopo. */
  orcado: Record<Escopo, Map<string, number>>;
  /** Realizado por "AAAA-MM-01|categoria_id" (todas as despesas do escopo, orçadas ou não). */
  realizado: Map<string, number>;
}

const hojeSp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const mesDe = (data: string) => `${data.slice(0, 7)}-01`;
const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

function ultimoDia(mes: string): number {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}
const vencimentoNoMes = (mes: string, dia: number) =>
  `${mes.slice(0, 7)}-${String(Math.min(dia, ultimoDia(mes))).padStart(2, '0')}`;

function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
}

/** Categorias da casa que as telas de fixas e de orçamento usam, mais duas individuais e uma receita. */
const categoriasDaCasa = (): SaidaLinhaCategorias[] => [
  categoria(),
  categoria({ id: ID_DELIVERY_CASAL, nome: 'Delivery/iFood do casal' }),
  categoria({ id: ID_MORADIA, nome: 'Moradia', variavel: false }),
  categoria({ id: ID_CONTAS_CASA, nome: 'Contas da casa', variavel: false }),
  categoria({ id: ID_OUTROS_CASA, nome: 'Outros da casa', variavel: false }),
  categoria({ id: ID_TRANSPORTE, nome: 'Transporte', escopo: 'individual' }),
  categoria({ id: ID_LAZER_PESSOAL, nome: 'Lazer pessoal', escopo: 'individual' }),
  categoria({ id: ID_SALARIO, nome: 'Salário', tipo: 'receita', escopo: 'individual', variavel: null }),
];

export function criarServidorFixas(parcial: Partial<ServidorFixas> = {}): ServidorFixas {
  const base = criarServidorLancamentos();
  const orcamento = lerResposta<SaidaOrcamentoMes>('orcamento-mes.json');
  const orcado = { conjunto: new Map<string, number>(), individual: new Map<string, number>() };
  const realizado = new Map<string, number>();
  for (const l of orcamento.linhas) {
    orcado.conjunto.set(`${orcamento.mes}|${l.categoria_id}`, l.orcado_centavos);
    realizado.set(`${orcamento.mes}|${l.categoria_id}`, l.realizado_centavos);
  }
  // Gasto individual do membro em outubro, sem orçamento: o escopo "Eu" começa sem orçamento no mês.
  realizado.set(`${orcamento.mes}|${ID_TRANSPORTE}`, 5000);
  return {
    ...base,
    categorias: categoriasDaCasa(),
    modelos: lerResposta<SaidaLinhaDespesasFixas[]>('despesas-fixas.json'),
    ocorrencias: lerResposta<{ ocorrencias: SaidaOcorrenciaMes[] }>('ocorrencias-mes.json').ocorrencias,
    pagamentos: [],
    orcado,
    realizado,
    ...parcial,
  };
}

/** Janela da RN-15 (CA-15.2): só grava para meses entre hoje − 12 e hoje + 12 meses; fora dela a leitura vem vazia. */
function dentroDaJanela(mes: string): boolean {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const [ha, hm] = hojeSp().split('-').map(Number) as [number, number];
  return Math.abs((a - ha) * 12 + (m - hm)) <= 12;
}

/** Garante as ocorrências do mês: 1 por fixa ativa (RN-15), sem tocar nas já geradas. */
function garantir(s: ServidorFixas, mes: string): void {
  if (!dentroDaJanela(mes)) return;
  for (const m of s.modelos) {
    if (m.encerrada_em !== null && mesDe(m.encerrada_em) < mes) continue;
    if (s.ocorrencias.some((o) => o.despesa_fixa_id === m.id && mesDe(o.vencimento) === mes)) continue;
    s.ocorrencias.push({
      id: crypto.randomUUID(),
      despesa_fixa_id: m.id,
      descricao: m.descricao,
      categoria: m.categoria,
      vencimento: vencimentoNoMes(mes, m.dia_vencimento),
      valor_previsto_centavos: m.valor_previsto_centavos,
      valor_pago_centavos: null,
      situacao: 'pendente',
      pagador: null,
    });
  }
}

const situacaoDe = (o: SaidaOcorrenciaMes): SaidaOcorrenciaMes['situacao'] =>
  o.pagador ? 'paga' : o.vencimento < hojeSp() ? 'atrasada' : 'pendente';

/** Ordem da RN-15: atrasadas, pendentes por vencimento crescente, pagas por vencimento decrescente. */
function ocorrenciasDoMes(s: ServidorFixas, mes: string) {
  garantir(s, mes);
  for (const o of s.ocorrencias) o.situacao = situacaoDe(o);
  const doMes = s.ocorrencias.filter((o) => mesDe(o.vencimento) === mes);
  const grupo = (o: SaidaOcorrenciaMes) => (o.situacao === 'atrasada' ? 0 : o.situacao === 'pendente' ? 1 : 2);
  const ordenadas = [...doMes].sort(
    (a, b) =>
      grupo(a) - grupo(b) ||
      (grupo(a) === 2 ? b.vencimento.localeCompare(a.vencimento) : a.vencimento.localeCompare(b.vencimento)),
  );
  const naoPagas = doMes.filter((o) => o.situacao !== 'paga');
  return {
    mes,
    pagas: doMes.length - naoPagas.length,
    total: doMes.length,
    previsto_a_pagar_centavos: naoPagas.reduce((t, o) => t + o.valor_previsto_centavos, 0),
    ocorrencias: ordenadas,
  };
}

function salvarFixa(s: ServidorFixas, id: string, c: Record<string, unknown>): Response {
  const categoriaFixa = s.categorias.find((x) => x.id === c.categoria_id);
  if (!categoriaFixa) return json({ code: 'registro_invalido', message: 'x' }, 404);
  const valor = Number(c.valor_previsto_centavos);
  const dia = Number(c.dia_vencimento);
  const descricao = typeof c.descricao === 'string' ? c.descricao.trim() : '';
  const valida =
    descricao !== '' &&
    Number.isInteger(valor) &&
    valor > 0 &&
    Number.isInteger(dia) &&
    dia >= 1 &&
    dia <= 31 &&
    categoriaFixa.tipo === 'despesa' &&
    categoriaFixa.escopo === 'conjunto';
  if (!valida) return json({ code: 'valor_invalido', message: 'x' }, 400);
  const existente = s.modelos.find((m) => m.id === id);
  if (existente?.encerrada_em) return json({ code: 'valor_invalido', message: 'x' }, 400);
  const campos = {
    descricao,
    categoria_id: categoriaFixa.id,
    categoria: categoriaFixa.nome,
    valor_previsto_centavos: valor,
    dia_vencimento: dia,
  };
  if (existente) {
    Object.assign(existente, campos);
    // Editar atualiza as ocorrências pendentes do mês corrente em diante; pagas e passadas ficam (RN-15).
    for (const o of s.ocorrencias) {
      if (o.despesa_fixa_id !== id || o.pagador || mesDe(o.vencimento) < mesDe(hojeSp())) continue;
      o.descricao = descricao;
      o.categoria = categoriaFixa.nome;
      o.valor_previsto_centavos = valor;
      o.vencimento = vencimentoNoMes(mesDe(o.vencimento), dia);
    }
    return json({ id }, 200);
  }
  s.modelos.push({ id, encerrada_em: null, ...campos });
  return json({ id }, 201);
}

function encerrarFixa(s: ServidorFixas, id: string): Response {
  const m = s.modelos.find((x) => x.id === id);
  if (!m) return json({ code: 'registro_invalido', message: 'x' }, 404);
  if (m.encerrada_em !== null) return semCorpo();
  m.encerrada_em = hojeSp();
  const mesDoEncerramento = mesDe(m.encerrada_em);
  s.ocorrencias = s.ocorrencias.filter(
    (o) => o.despesa_fixa_id !== id || o.pagador !== null || mesDe(o.vencimento) <= mesDoEncerramento,
  );
  return semCorpo();
}

function pagar(s: ServidorFixas, ocorrenciaId: string, c: Record<string, unknown>): Response {
  const o = s.ocorrencias.find((x) => x.id === ocorrenciaId);
  if (!o) return json({ code: 'registro_invalido', message: 'x' }, 404);
  const id = String(c.id);
  const anterior = s.pagamentos.find((p) => p.ocorrenciaId === ocorrenciaId);
  const resposta = (p: PagamentoGravado, jaExistia: boolean) =>
    json(
      {
        ocorrencia_id: ocorrenciaId,
        lancamento_id: p.id,
        situacao: 'paga',
        valor_pago_centavos: p.valorCentavos,
        // A parcela da casa fica no vencimento da ocorrência, qualquer que seja a data da operação (RN-15, I-20).
        vencimento: o.vencimento,
        ja_existia: jaExistia,
      },
      jaExistia ? 200 : 201,
    );
  if (o.pagador) {
    // CA-15.5: o mesmo id devolve o gravado; outro id é `ocorrencia_paga`.
    if (anterior && anterior.id === id) return resposta(anterior, true);
    return json({ code: 'ocorrencia_paga', message: 'x' }, 409);
  }
  const forma = s.dados.formas.find((f) => f.id === c.forma_id);
  if (!forma) return json({ code: 'registro_invalido', message: 'x' }, 404);
  const valor =
    c.valor_centavos === undefined || c.valor_centavos === null ? o.valor_previsto_centavos : Number(c.valor_centavos);
  const data = typeof c.data === 'string' ? c.data : null;
  const limite = new Date(`${hojeSp()}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 30);
  if (!Number.isInteger(valor) || valor <= 0) return json({ code: 'valor_invalido', message: 'x' }, 400);
  if (data !== null && (data < '2000-01-01' || data > limite.toISOString().slice(0, 10))) {
    return json({ code: 'valor_invalido', message: 'x' }, 400);
  }
  const gravado = { id, ocorrenciaId, formaId: forma.id, data, valorCentavos: valor };
  s.pagamentos.push(gravado);
  o.pagador = { nome: 'Ana', sou_eu: true };
  o.valor_pago_centavos = valor;
  o.situacao = 'paga';
  return resposta(gravado, false);
}

function desfazer(s: ServidorFixas, ocorrenciaId: string): Response {
  const o = s.ocorrencias.find((x) => x.id === ocorrenciaId);
  if (!o) return json({ code: 'registro_invalido', message: 'x' }, 404);
  if (!o.pagador) return semCorpo();
  if (!o.pagador.sou_eu) return json({ code: 'sem_permissao', message: 'x' }, 403);
  o.pagador = null;
  o.valor_pago_centavos = null;
  s.pagamentos = s.pagamentos.filter((p) => p.ocorrenciaId !== ocorrenciaId);
  o.situacao = situacaoDe(o);
  return semCorpo();
}

/** Situação pela razão exata em inteiros (RT-05, RN-16): nunca pelo percentual arredondado. */
function situacaoOrcamento(orcado: number, realizado: number): 'dentro' | 'atencao' | 'estourado' {
  if (realizado * 100 < orcado * 80) return 'dentro';
  return realizado <= orcado ? 'atencao' : 'estourado';
}

function orcamentoDoMes(s: ServidorFixas, mes: string, escopo: Escopo): SaidaOrcamentoMes {
  const doEscopo = s.categorias.filter((c) => c.tipo === 'despesa' && c.escopo === escopo && !c.arquivada);
  const orcadoDe = (id: string) => s.orcado[escopo].get(`${mes}|${id}`);
  const linhas = doEscopo
    .filter((c) => orcadoDe(c.id) !== undefined)
    .map((c) => {
      const orcado = orcadoDe(c.id)!;
      const realizado = s.realizado.get(`${mes}|${c.id}`) ?? 0;
      return {
        categoria_id: c.id,
        nome: c.nome,
        orcado_centavos: orcado,
        realizado_centavos: realizado,
        percentual: Math.round((100 * realizado) / orcado),
        situacao: situacaoOrcamento(orcado, realizado),
      };
    })
    .sort((a, b) => b.percentual - a.percentual || a.nome.localeCompare(b.nome));
  const orcadoTotal = linhas.reduce((t, l) => t + l.orcado_centavos, 0);
  const realizadoTotal = doEscopo.reduce((t, c) => t + (s.realizado.get(`${mes}|${c.id}`) ?? 0), 0);
  const anterior = mesAnterior(mes);
  const resumoAnterior = (e: Escopo) => {
    const itens = [...s.orcado[e].entries()].filter(([k]) => k.startsWith(`${anterior}|`));
    return { categorias: itens.length, orcado_centavos: itens.reduce((t, [, v]) => t + v, 0) };
  };
  const temOrcamento = (e: Escopo) => [...s.orcado[e].keys()].some((k) => k.startsWith(`${mes}|`));
  const pode = (e: Escopo) => !temOrcamento(e) && resumoAnterior(e).categorias > 0;
  return {
    mes,
    escopo,
    pode_copiar_anterior: { conjunto: pode('conjunto'), individual: pode('individual') },
    ...(pode(escopo) && { anterior: { mes: anterior, ...resumoAnterior(escopo) } }),
    total:
      linhas.length === 0
        ? null
        : {
            orcado_centavos: orcadoTotal,
            realizado_centavos: realizadoTotal,
            percentual: Math.round((100 * realizadoTotal) / orcadoTotal),
            situacao: situacaoOrcamento(orcadoTotal, realizadoTotal),
            resultado_centavos: orcadoTotal - realizadoTotal,
            parcial: mes >= mesDe(hojeSp()),
          },
    linhas,
    sem_orcamento: doEscopo
      .filter((c) => orcadoDe(c.id) === undefined)
      .map((c) => ({ categoria_id: c.id, nome: c.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}

function definirOrcamento(s: ServidorFixas, mes: string, categoriaId: string, c: Record<string, unknown>): Response {
  const cat = s.categorias.find((x) => x.id === categoriaId && x.tipo === 'despesa');
  if (!cat) return json({ code: 'registro_invalido', message: 'x' }, 404);
  const mapa = s.orcado[cat.escopo];
  const chave = `${mes}|${categoriaId}`;
  if (c.valor_centavos === undefined || c.valor_centavos === null) {
    mapa.delete(chave);
    return semCorpo();
  }
  const valor = Number(c.valor_centavos);
  if (cat.arquivada) return json({ code: 'registro_invalido', message: 'x' }, 404);
  if (!Number.isInteger(valor) || valor <= 0) return json({ code: 'valor_invalido', message: 'x' }, 400);
  mapa.set(chave, valor);
  return semCorpo();
}

/** Copia do mês anterior sem sobrescrever o que o mês já tem (CA-16.7) e pulando categorias arquivadas. */
function copiarOrcamento(s: ServidorFixas, mes: string, escopo: Escopo): Response {
  const anterior = mesAnterior(mes);
  const mapa = s.orcado[escopo];
  let copiadas = 0;
  for (const [chave, valor] of [...mapa.entries()]) {
    if (!chave.startsWith(`${anterior}|`)) continue;
    const id = chave.split('|')[1]!;
    const cat = s.categorias.find((x) => x.id === id);
    const nova = `${mes}|${id}`;
    if (!cat || cat.arquivada || mapa.has(nova)) continue;
    mapa.set(nova, valor);
    copiadas += 1;
  }
  return json({ copiadas });
}

async function atenderFixas(s: ServidorFixas, metodo: string, url: string, corpo: Corpo) {
  const alvo = new URL(url, 'http://x');
  const caminho = alvo.pathname;
  const chave = `${metodo} ${caminho
    .replace(/\/[0-9a-f-]{36}(?=\/|$)/g, '/:id')
    .replace(/\/\d{4}-\d{2}-\d{2}(?=\/|$)/g, '/:mes')}`;
  const atraso = s.atrasos.get(chave);
  if (atraso) await dormir(atraso);
  const falha = s.falhas.get(chave);
  if (falha) return json({ code: falha.code, message: 'x' }, falha.status);

  if (caminho === '/api/fixas' && metodo === 'GET') return json(s.modelos);
  if (caminho === '/api/fixas/ocorrencias' && metodo === 'GET') {
    return json(ocorrenciasDoMes(s, mesDe(alvo.searchParams.get('mes') ?? hojeSp())));
  }
  const f = /^\/api\/fixas\/([^/]+)(?:\/(encerrar))?$/.exec(caminho);
  if (f && metodo === 'PUT' && !f[2]) return salvarFixa(s, f[1]!, corpo ?? {});
  if (f && metodo === 'POST' && f[2]) return encerrarFixa(s, f[1]!);
  const o = /^\/api\/ocorrencias\/([^/]+)\/pagamento$/.exec(caminho);
  if (o && metodo === 'POST') return pagar(s, o[1]!, corpo ?? {});
  if (o && metodo === 'DELETE') return desfazer(s, o[1]!);
  if (caminho === '/api/orcamento' && metodo === 'GET') {
    const escopo = alvo.searchParams.get('escopo') === 'individual' ? 'individual' : 'conjunto';
    return json(orcamentoDoMes(s, mesDe(alvo.searchParams.get('mes') ?? hojeSp()), escopo));
  }
  const copia = /^\/api\/orcamento\/(\d{4}-\d{2}-\d{2})\/copiar$/.exec(caminho);
  if (copia && metodo === 'POST') {
    return copiarOrcamento(s, copia[1]!, corpo?.escopo === 'individual' ? 'individual' : 'conjunto');
  }
  const valor = /^\/api\/orcamento\/(\d{4}-\d{2}-\d{2})\/([^/]+)$/.exec(caminho);
  if (valor && metodo === 'PUT') return definirOrcamento(s, valor[1]!, valor[2]!, corpo ?? {});
  return undefined;
}

/** Troca o `fetch` global pelo simulado. Quem chama desfaz com `vi.unstubAllGlobals()`. */
export function instalarApiFixas(s: ServidorFixas): void {
  const simulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    s.chamadas.push({ metodo, url, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> });
    if (s.semRede) throw new TypeError('Failed to fetch');
    return (await atenderFixas(s, metodo, url, corpo)) ?? (await atender(s, metodo, url, corpo));
  });
  vi.stubGlobal('fetch', simulado);
}

/** Pré-aquece as telas por `lazy` deste lote (as dos lotes anteriores seguem em `preAquecerPaginas`). */
export const preAquecerFixas = () =>
  Promise.all([
    import('@controle/contrato'),
    import('../../src/paginas/DespesasFixas'),
    import('../../src/paginas/DespesaFixa'),
    import('../../src/paginas/Orcamento'),
    import('../../src/paginas/Ajustes'),
    import('../../src/paginas/Lancamento'),
  ]);
