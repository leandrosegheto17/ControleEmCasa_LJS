import type { SaidaLarDetalhe, SaidaLinhaMetas, SaidaMovimentoMeta } from '@controle/contrato';
import { vi } from 'vitest';
import { json, semCorpo } from './apiCadastros';
import { atender } from './apiLancamentos';
import { atenderFixas, criarServidorFixas, type ServidorFixas } from './apiFixas';
import { lerResposta } from './fetchSimulado';

/**
 * API simulada das metas, dos movimentos e do lar (etapa 12, lote 4), por cima da das fixas e do orçamento: estado em
 * memória, cada chamada registrada, respostas no formato do contrato (SDD 6.1 #37 a #41; SDD 6.2). As regras que o
 * servidor decide seguem o critério de aceite do PRD-TECNICO (RN-08, RN-09, RN-22, RN-23; CA-08.x, CA-09.x, CA-23.x),
 * nunca o código das telas: guardado = aportes - retiradas, percentual limitado a 99 até atingir, retirada limitada
 * ao guardado do local, escopo só na criação, individual do outro membro invisível, convite de 7 dias.
 */

export const ID_RESERVA = '00000000-0000-4000-8000-000000000901';
export const ID_VIAGEM = '00000000-0000-4000-8000-000000000902';
export const ID_NOTEBOOK = '00000000-0000-4000-8000-000000000903';
export const ID_CURSO = '00000000-0000-4000-8000-000000000904';
export const ID_CARRO = '00000000-0000-4000-8000-000000000905';
export const ID_CONVITE = '00000000-0000-4000-8000-000000000c01';

type Corpo = Record<string, unknown> | undefined;

interface MetaGravada {
  id: string;
  nome: string;
  escopo: 'conjunto' | 'individual';
  alvo: number;
  /** `AAAA-MM`. */
  prazo: string | null;
  /** Individual do outro membro: não aparece para a sessão simulada (RT-01). */
  doOutro: boolean;
}
interface MovimentoGravado {
  id: string;
  metaId: string;
  tipo: 'aporte' | 'retirada';
  valor: number;
  data: string;
  local: string;
  autor: { nome: string; sou_eu: boolean };
  conta?: string;
}

export interface ServidorMetas extends ServidorFixas {
  metas: MetaGravada[];
  movimentos: MovimentoGravado[];
  lar: SaidaLarDetalhe;
}

const hojeSp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/** As quatro metas e os movimentos das fixtures, gravados do jeito que o servidor guarda. */
function iniciais(): Pick<ServidorMetas, 'metas' | 'movimentos'> {
  const metas: MetaGravada[] = lerResposta<SaidaLinhaMetas[]>('metas.json').map((l) => ({
    id: l.id,
    nome: l.nome,
    escopo: l.escopo,
    alvo: l.alvo_centavos,
    prazo: l.prazo,
    doOutro: false,
  }));
  const movimentos: MovimentoGravado[] = lerResposta<SaidaMovimentoMeta[]>('movimentos-meta.json').map((m) => ({
    id: m.id,
    metaId: ID_VIAGEM,
    tipo: m.tipo,
    valor: m.valor_centavos,
    data: m.data,
    local: m.local,
    autor: m.autor,
    ...(m.conta && { conta: m.conta.nome }),
  }));
  // Um aporte único em cada uma das outras metas, para o guardado das fixtures valer.
  const aporte = (metaId: string, valor: number, local: string): MovimentoGravado => ({
    id: crypto.randomUUID(),
    metaId,
    tipo: 'aporte',
    valor,
    data: '2026-09-01',
    local,
    autor: { nome: 'Ana', sou_eu: true },
  });
  movimentos.push(
    aporte(ID_RESERVA, 1850000, 'Poupança'),
    aporte(ID_NOTEBOOK, 240000, 'Caixinha Nubank'),
    aporte(ID_CURSO, 180000, 'Caixinha Nubank'),
  );
  return { metas, movimentos };
}

export function criarServidorMetas(parcial: Partial<ServidorMetas> = {}): ServidorMetas {
  return {
    ...criarServidorFixas(),
    ...iniciais(),
    lar: lerResposta<SaidaLarDetalhe>('lar-dois-membros.json'),
    ...parcial,
  };
}

const mesesEntre = (de: string, ate: string) => {
  const [a, m] = de.split('-').map(Number) as [number, number];
  const [pa, pm] = ate.split('-').map(Number) as [number, number];
  return (pa - a) * 12 + (pm - m);
};

function guardadoDe(s: ServidorMetas, metaId: string, local?: string): number {
  return s.movimentos
    .filter((m) => m.metaId === metaId && (local === undefined || m.local === local))
    .reduce((t, m) => t + (m.tipo === 'aporte' ? m.valor : -m.valor), 0);
}

/** Progresso da RN-08 (CA-08.3, CA-08.4), sempre em inteiros: percentual limitado a 99 até atingir. */
function linha(s: ServidorMetas, m: MetaGravada, comLocais: boolean): SaidaLinhaMetas {
  const guardado = guardadoDe(s, m.id);
  const atingida = guardado >= m.alvo;
  const falta = Math.max(0, m.alvo - guardado);
  const percentual = atingida ? 100 : Math.min(99, Math.round((100 * guardado) / m.alvo));
  const restantes = m.prazo === null ? null : Math.max(1, mesesEntre(hojeSp().slice(0, 7), m.prazo));
  const locais = [...new Set(s.movimentos.filter((x) => x.metaId === m.id).map((x) => x.local))].map((local) => ({
    local,
    guardado_centavos: guardadoDe(s, m.id, local),
  }));
  locais.sort((a, b) => b.guardado_centavos - a.guardado_centavos || a.local.localeCompare(b.local));
  return {
    id: m.id,
    nome: m.nome,
    escopo: m.escopo,
    alvo_centavos: m.alvo,
    guardado_centavos: guardado,
    falta_centavos: falta,
    percentual,
    prazo: m.prazo,
    mensal_necessario_centavos: restantes === null || falta === 0 ? null : Math.ceil(falta / restantes),
    atingida,
    ...(comLocais && { por_local: locais }),
  };
}

const visiveis = (s: ServidorMetas) => s.metas.filter((m) => !m.doOutro);
const registroInvalido = () => json({ code: 'registro_invalido', message: 'x' }, 404);
const valorInvalido = () => json({ code: 'valor_invalido', message: 'x' }, 400);

function salvarMeta(s: ServidorMetas, id: string, c: Record<string, unknown>): Response {
  const nome = typeof c.nome === 'string' ? c.nome.trim() : '';
  const alvo = c.alvo_centavos;
  const prazo = typeof c.prazo === 'string' ? c.prazo : null;
  if (
    nome === '' ||
    typeof alvo !== 'number' ||
    !Number.isInteger(alvo) ||
    alvo <= 0 ||
    (prazo !== null && !/^\d{4}-\d{2}-\d{2}$/.test(prazo))
  ) {
    return valorInvalido();
  }
  const mes = prazo === null ? null : prazo.slice(0, 7);
  const existente = s.metas.find((m) => m.id === id);
  if (existente) {
    if (existente.doOutro) return registroInvalido();
    // CA-08.2: o escopo só vale na criação; outro escopo na edição é recusado.
    if (c.escopo !== undefined && c.escopo !== existente.escopo) return valorInvalido();
    Object.assign(existente, { nome, alvo, prazo: mes });
    return json({ id }, 200);
  }
  if (c.escopo !== 'conjunto' && c.escopo !== 'individual') return valorInvalido();
  s.metas.push({ id, nome, escopo: c.escopo, alvo, prazo: mes, doOutro: false });
  return json({ id }, 201);
}

function movimentar(s: ServidorMetas, metaId: string, c: Record<string, unknown>): Response {
  const tipo = c.tipo;
  const valor = c.valor_centavos;
  const local = typeof c.local === 'string' ? c.local.trim() : '';
  const data = typeof c.data === 'string' ? c.data : hojeSp();
  if (
    (tipo !== 'aporte' && tipo !== 'retirada') ||
    typeof valor !== 'number' ||
    !Number.isInteger(valor) ||
    valor <= 0 ||
    local === '' ||
    local.length > 60
  ) {
    return valorInvalido();
  }
  const id = String(c.id);
  // Reenvio do mesmo id pelo mesmo autor devolve o gravado, sem gravar de novo (ADR-010).
  if (s.movimentos.some((m) => m.id === id)) return json({ id }, 200);
  if (!s.metas.some((m) => m.id === metaId && !m.doOutro)) return registroInvalido();
  const conta = c.conta_id === undefined || c.conta_id === null ? undefined : s.contas.find((x) => x.id === c.conta_id);
  if (c.conta_id && (!conta || conta.arquivada)) return registroInvalido();
  // CA-09.1: o limite é o guardado NAQUELE local, mesmo havendo saldo em outros.
  if (tipo === 'retirada' && valor > guardadoDe(s, metaId, local)) {
    return json({ code: 'retirada_maior_que_guardado', message: 'x' }, 422);
  }
  s.movimentos.push({
    id,
    metaId,
    tipo,
    valor,
    data,
    local,
    autor: { nome: 'Ana', sou_eu: true },
    ...(conta && { conta: conta.nome }),
  });
  if (conta) conta.saldo_centavos += tipo === 'aporte' ? -valor : valor;
  return json({ id }, 201);
}

const souTitular = (s: ServidorMetas) => s.lar.membros.find((m) => m.sou_eu)?.papel === 'titular';

function convidar(s: ServidorMetas, c: Record<string, unknown>): Response {
  if (!souTitular(s)) return registroInvalido();
  const email = typeof c.email === 'string' ? c.email.trim().toLowerCase() : '';
  // CA-23.7: o titular não convida o próprio e-mail.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === 'ana@exemplo.com') return valorInvalido();
  if (s.lar.membros.length >= 2) return json({ code: 'lar_cheio', message: 'x' }, 409);
  if (s.lar.convite_pendente) return json({ code: 'convite_pendente', message: 'x' }, 409);
  const expira = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  s.lar.convite_pendente = { id: ID_CONVITE, email, expira_em: expira };
  return json({ id: ID_CONVITE, email, expira_em: expira }, 201);
}

function movimentosDaMeta(s: ServidorMetas, id: string): Response {
  if (!s.metas.some((m) => m.id === id && !m.doOutro)) return registroInvalido();
  const lista: SaidaMovimentoMeta[] = s.movimentos
    .filter((x) => x.metaId === id)
    .sort((a, b) => b.data.localeCompare(a.data))
    .map((x) => ({
      id: x.id,
      tipo: x.tipo,
      valor_centavos: x.valor,
      data: x.data,
      local: x.local,
      autor: x.autor,
      // CA-08.5: a conta só existe nas linhas do próprio autor.
      ...(x.autor.sou_eu && x.conta && { conta: { nome: x.conta } }),
    }));
  return json(lista);
}

export async function atenderMetas(s: ServidorMetas, metodo: string, url: string, corpo: Corpo) {
  const alvo = new URL(url, 'http://x');
  const caminho = alvo.pathname;
  const chave = `${metodo} ${caminho.replace(/\/[0-9a-f-]{36}(?=\/|$)/g, '/:id')}`;
  const atraso = s.atrasos.get(chave);
  if (atraso) await dormir(atraso);
  const falha = s.falhas.get(chave);
  if (falha) return json({ code: falha.code, message: 'x' }, falha.status);

  if (caminho === '/api/metas' && metodo === 'GET') {
    const lista = visiveis(s).map((m) => linha(s, m, false));
    return json(lista.sort((a, b) => Number(a.atingida) - Number(b.atingida) || a.nome.localeCompare(b.nome, 'pt-BR')));
  }
  if (caminho === '/api/metas/locais' && metodo === 'GET') {
    const usados = visiveis(s).flatMap((m) => s.movimentos.filter((x) => x.metaId === m.id));
    const ordenados = [...usados].sort((a, b) => b.data.localeCompare(a.data));
    return json([...new Set(ordenados.map((x) => x.local))]);
  }
  const m = /^\/api\/metas\/([^/]+)(?:\/(movimentos))?$/.exec(caminho);
  if (m) {
    const id = m[1]!;
    if (metodo === 'PUT' && !m[2]) return salvarMeta(s, id, corpo ?? {});
    if (metodo === 'POST' && m[2]) return movimentar(s, id, corpo ?? {});
    if (metodo === 'GET' && m[2]) return movimentosDaMeta(s, id);
    if (metodo === 'GET') {
      const meta = s.metas.find((x) => x.id === id && !x.doOutro);
      return meta ? json(linha(s, meta, true)) : registroInvalido();
    }
  }
  if (caminho === '/api/lar' && metodo === 'GET') {
    // O convite pendente só aparece ao titular (SDD 6.2).
    const { convite_pendente: pendente, ...resto } = s.lar;
    return json(souTitular(s) && pendente ? s.lar : resto);
  }
  if (caminho === '/api/lar/convites' && metodo === 'POST') return convidar(s, corpo ?? {});
  const revogar = /^\/api\/lar\/convites\/([^/]+)$/.exec(caminho);
  if (revogar && metodo === 'DELETE') {
    if (!souTitular(s)) return registroInvalido();
    if (s.lar.convite_pendente?.id === revogar[1]) delete s.lar.convite_pendente;
    return semCorpo();
  }
  return undefined;
}

/** Troca o `fetch` global pelo simulado. Quem chama desfaz com `vi.unstubAllGlobals()`. */
export function instalarApiMetas(s: ServidorMetas): void {
  const simulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    s.chamadas.push({ metodo, url, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> });
    if (s.semRede) throw new TypeError('Failed to fetch');
    return (
      (await atenderMetas(s, metodo, url, corpo)) ??
      (await atenderFixas(s, metodo, url, corpo)) ??
      (await atender(s, metodo, url, corpo))
    );
  });
  vi.stubGlobal('fetch', simulado);
}

/** Pré-aquece as telas por `lazy` deste lote (as dos lotes anteriores seguem em `preAquecerPaginas`). */
export const preAquecerMetas = () =>
  Promise.all([
    import('@controle/contrato'),
    import('../../src/paginas/Metas'),
    import('../../src/paginas/Meta'),
    import('../../src/paginas/MetaFormulario'),
    import('../../src/paginas/Lar'),
    import('../../src/paginas/Ajustes'),
  ]);
