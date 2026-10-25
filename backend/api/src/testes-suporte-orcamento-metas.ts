import { sql } from 'kysely';
import { larParaFixas, novoId, type App } from './testes-suporte-fixas';
import { json, linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';

/** Utilitários dos testes de orçamento e metas (etapa 10). Só para testes: fora da varredura de código de produção. */

export { larParaFixas, novoId, type App };

export type Escopo = 'conjunto' | 'individual';

/** Lar com Ana e Bruno prontos (relógio parado em 24/10/2026), como o das fixas. */
export const larParaOrcamento = larParaFixas;

/** `PUT /api/orcamento/:mes/:categoria`; `valor` ausente remove. Devolve a resposta crua. */
export function definirOrcamento(
  app: App,
  quem: Pessoa,
  mes: string,
  categoria: string,
  valor?: number | null,
): Promise<Response> {
  return pedir(
    app,
    'PUT',
    `/api/orcamento/${mes}/${categoria}`,
    quem,
    valor === undefined ? {} : { valor_centavos: valor },
  );
}

/** Define e falha o teste se não for 204. */
export async function definirOrcamentoOk(
  app: App,
  quem: Pessoa,
  mes: string,
  categoria: string,
  valor: number | null,
): Promise<void> {
  const r = await definirOrcamento(app, quem, mes, categoria, valor);
  if (r.status !== 204) throw new Error(`definir orçamento falhou: ${r.status} ${await r.text()}`);
}

export interface LinhaVista {
  categoria_id: string;
  nome: string;
  orcado_centavos: number;
  realizado_centavos: number;
  percentual: number;
  situacao: 'dentro' | 'atencao' | 'estourado';
}

export interface OrcamentoVisto {
  mes: string;
  escopo: Escopo;
  pode_copiar_anterior: { conjunto: boolean; individual: boolean };
  anterior?: { mes: string; orcado_centavos: number; categorias: number };
  total: {
    orcado_centavos: number;
    realizado_centavos: number;
    percentual: number;
    situacao: string;
    resultado_centavos: number;
    parcial: boolean;
  } | null;
  linhas: LinhaVista[];
  sem_orcamento: { categoria_id: string; nome: string }[];
}

export async function orcamentoDoMes(app: App, quem: Pessoa, mes?: string, escopo?: Escopo): Promise<OrcamentoVisto> {
  const q = [mes ? `mes=${mes}` : '', escopo ? `escopo=${escopo}` : ''].filter(Boolean).join('&');
  const r = await pedir(app, 'GET', `/api/orcamento${q ? `?${q}` : ''}`, quem);
  if (r.status !== 200) throw new Error(`orçamento falhou: ${r.status} ${await r.text()}`);
  return json<OrcamentoVisto>(r);
}

export interface CorpoMeta {
  nome?: string;
  alvo_centavos?: number;
  prazo?: string | null;
  escopo?: Escopo;
}

/** Cria uma meta pela rota (falha o teste se não for 201) e devolve o id. */
export async function criarMeta(app: App, quem: Pessoa, corpo: CorpoMeta = {}, id = novoId()): Promise<string> {
  const r = await pedir(app, 'PUT', `/api/metas/${id}`, quem, {
    nome: 'Viagem',
    alvo_centavos: 100_000,
    escopo: 'conjunto',
    ...corpo,
  });
  if (r.status !== 201) throw new Error(`criar meta falhou: ${r.status} ${await r.text()}`);
  return id;
}

export interface CorpoMovimento {
  id?: string;
  tipo?: 'aporte' | 'retirada';
  valor_centavos?: number;
  local?: string;
  data?: string;
  conta_id?: string;
}

export function movimentar(app: App, quem: Pessoa, meta: string, corpo: CorpoMovimento = {}): Promise<Response> {
  return pedir(app, 'POST', `/api/metas/${meta}/movimentos`, quem, {
    id: novoId(),
    tipo: 'aporte',
    valor_centavos: 1000,
    local: 'Nubank',
    ...corpo,
  });
}

/** Movimenta e falha o teste se não for 201; devolve o id do movimento. */
export async function movimentarOk(app: App, quem: Pessoa, meta: string, corpo: CorpoMovimento = {}): Promise<string> {
  const id = corpo.id ?? novoId();
  const r = await movimentar(app, quem, meta, { ...corpo, id });
  if (r.status !== 201) throw new Error(`movimentar falhou: ${r.status} ${await r.text()}`);
  return id;
}

export interface MetaVista {
  id: string;
  nome: string;
  escopo: Escopo;
  alvo_centavos: number;
  guardado_centavos: number;
  falta_centavos: number;
  percentual: number;
  prazo: string | null;
  mensal_necessario_centavos: number | null;
  atingida: boolean;
  por_local?: { local: string; guardado_centavos: number }[];
}

export async function detalheDaMeta(app: App, quem: Pessoa, id: string): Promise<MetaVista> {
  const r = await pedir(app, 'GET', `/api/metas/${id}`, quem);
  if (r.status !== 200) throw new Error(`meta falhou: ${r.status} ${await r.text()}`);
  return json<MetaVista>(r);
}

export interface MovimentoVisto {
  id: string;
  tipo: 'aporte' | 'retirada';
  valor_centavos: number;
  data: string;
  local: string;
  autor: { nome: string; sou_eu: boolean };
  conta?: { nome: string };
}

export async function movimentosDaMeta(app: App, quem: Pessoa, meta: string): Promise<MovimentoVisto[]> {
  const r = await pedir(app, 'GET', `/api/metas/${meta}/movimentos`, quem);
  if (r.status !== 200) throw new Error(`movimentos falhou: ${r.status} ${await r.text()}`);
  return json<MovimentoVisto[]>(r);
}

/** A meta como o owner a vê (inspeção). */
export async function metaNoBanco(id: string) {
  const r = await linhasComoOwner(
    sql<{ nome: string; alvo: string; prazo: string | null; escopo: string; atingida_em: string | null }>`
      select nome, alvo_centavos::text as alvo, prazo::text as prazo, escopo, atingida_em::text as atingida_em
        from app.meta where id = ${id}`,
  );
  return r[0] ?? null;
}

/** Quantos movimentos de meta e de conta ligados existem para a meta (inspeção). */
export async function contagemDeMovimentos(meta: string) {
  const r = await linhasComoOwner(
    sql<{ metas: number; contas: number }>`
      select (select count(*)::int from app.movimento_meta where meta_id = ${meta}) as metas,
             (select count(*)::int from app.movimento_conta mc
                join app.movimento_meta mm on mm.id = mc.movimento_meta_id where mm.meta_id = ${meta}) as contas`,
  );
  return r[0]!;
}
