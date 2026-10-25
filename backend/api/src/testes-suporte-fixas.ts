import { sql } from 'kysely';
import { relogioControlado } from './testes-suporte-acesso';
import { listar, novoId, type App } from './testes-suporte-cadastros';
import { larParaLancar } from './testes-suporte-lancamentos';
import { json, linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';

/** Utilitários dos testes de fixas e do resumo (etapa 9). Só para testes: fora da varredura de código de produção. */

export { novoId, type App };

/** "Hoje" dos testes de fixa: 24/10/2026 em São Paulo (12:00), o mesmo do exemplo do CA-15.2. */
export const AGORA_FIXAS = new Date('2026-10-24T15:00:00.000Z');

/** Lar com Ana e Bruno prontos para lançar, com relógio parado em `agora` e a categoria conjunta "Moradia". */
export async function larParaFixas(prefixo: string, agora = AGORA_FIXAS) {
  const relogio = relogioControlado(agora);
  const base = await larParaLancar(prefixo, { relogio: relogio.relogio, agora: relogio.agora() });
  const categorias = await listar<{ id: string; nome: string; tipo: string; escopo: string }>(
    base.app,
    '/api/categorias',
    base.titular,
  );
  const moradia = categorias.find((c) => c.nome === 'Moradia' && c.escopo === 'conjunto')!.id;
  return { ...base, relogio, moradia };
}

export interface CorpoFixa {
  descricao?: string;
  categoria_id: string;
  valor_previsto_centavos?: number;
  dia_vencimento?: number;
}

/** Cria uma fixa pela rota (falha o teste se não for 201) e devolve o id. */
export async function criarFixa(app: App, quem: Pessoa, corpo: CorpoFixa, id = novoId()): Promise<string> {
  const r = await pedir(app, 'PUT', `/api/fixas/${id}`, quem, {
    descricao: 'Aluguel',
    valor_previsto_centavos: 150_000,
    dia_vencimento: 10,
    ...corpo,
  });
  if (r.status !== 201) throw new Error(`criar fixa falhou: ${r.status} ${await r.text()}`);
  return id;
}

export interface OcorrenciaVista {
  id: string;
  despesa_fixa_id: string;
  descricao: string;
  categoria: string;
  vencimento: string;
  valor_previsto_centavos: number;
  valor_pago_centavos: number | null;
  situacao: 'paga' | 'atrasada' | 'pendente';
  pagador: { nome: string; sou_eu: boolean } | null;
}

export interface OcorrenciasVistas {
  mes: string;
  pagas: number;
  total: number;
  previsto_a_pagar_centavos: number;
  ocorrencias: OcorrenciaVista[];
}

export async function ocorrencias(app: App, quem: Pessoa, mes: string): Promise<OcorrenciasVistas> {
  const r = await pedir(app, 'GET', `/api/fixas/ocorrencias?mes=${mes}`, quem);
  if (r.status !== 200) throw new Error(`ocorrências falhou: ${r.status} ${await r.text()}`);
  return json<OcorrenciasVistas>(r);
}

/** A ocorrência da fixa no mês (gera se preciso). */
export async function ocorrenciaDe(app: App, quem: Pessoa, fixa: string, mes: string): Promise<OcorrenciaVista> {
  const o = (await ocorrencias(app, quem, mes)).ocorrencias.find((x) => x.despesa_fixa_id === fixa);
  if (!o) throw new Error('ocorrência não encontrada');
  return o;
}

export function pagar(
  app: App,
  quem: Pessoa,
  ocorrencia: string,
  corpo: { id?: string; forma_id: string; valor_centavos?: number; data?: string },
): Promise<Response> {
  return pedir(app, 'POST', `/api/ocorrencias/${ocorrencia}/pagamento`, quem, { id: novoId(), ...corpo });
}

/** Paga e devolve o id do lançamento; falha o teste se não for 201. */
export async function pagarOk(
  app: App,
  quem: Pessoa,
  ocorrencia: string,
  corpo: { id?: string; forma_id: string; valor_centavos?: number; data?: string },
): Promise<string> {
  const id = corpo.id ?? novoId();
  const r = await pagar(app, quem, ocorrencia, { ...corpo, id });
  if (r.status !== 201) throw new Error(`pagar falhou: ${r.status} ${await r.text()}`);
  return id;
}

export async function resumo<T = Record<string, unknown>>(app: App, quem: Pessoa, mes?: string): Promise<T> {
  const r = await pedir(app, 'GET', mes ? `/api/resumo?mes=${mes}` : '/api/resumo', quem);
  if (r.status !== 200) throw new Error(`resumo falhou: ${r.status} ${await r.text()}`);
  return json<T>(r);
}

/** Ocorrências gravadas da fixa, como o owner as vê (inspeção, fora da RLS). */
export async function ocorrenciasNoBanco(fixa: string) {
  return linhasComoOwner(
    sql<{ id: string; mes: string; vencimento: string; previsto: string; lancamento_id: string | null }>`
      select id, mes::text as mes, vencimento::text as vencimento, valor_previsto_centavos::text as previsto,
             lancamento_id
        from app.ocorrencia_fixa where despesa_fixa_id = ${fixa} order by mes`,
  );
}

/** A fixa como o owner a vê (inspeção). */
export async function fixaNoBanco(id: string) {
  const r = await linhasComoOwner(
    sql<{ descricao: string; previsto: string; dia: number; inicio: string; encerrada_em: string | null }>`
      select descricao, valor_previsto_centavos::text as previsto, dia_vencimento::int as dia, inicio::text as inicio,
             encerrada_em::text as encerrada_em
        from app.despesa_fixa where id = ${id}`,
  );
  return r[0] ?? null;
}

/** Grava uma ocorrência direto no banco (owner), para preparar meses que o relógio do teste já passou. */
export async function ocorrenciaComoOwner(dados: {
  larId: string;
  fixa: string;
  mes: string;
  vencimento: string;
  previsto: number;
}): Promise<string> {
  const r = await linhasComoOwner(
    sql<{ id: string }>`
      insert into app.ocorrencia_fixa (lar_id, despesa_fixa_id, mes, vencimento, valor_previsto_centavos)
      values (${dados.larId}, ${dados.fixa}, ${dados.mes}::date, ${dados.vencimento}::date, ${dados.previsto})
      returning id`,
  );
  return r[0]!.id;
}
