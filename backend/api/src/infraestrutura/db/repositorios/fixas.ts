import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Despesas fixas e ocorrências (SDD 3.5; RN-15, RN-28). As duas tabelas são do lar: toda consulta filtra por
 * `lar_id` além da RLS (CA-T1.4). Nenhuma função daqui lê a parte privada do pagamento (forma, conta, data da
 * operação): a ocorrência mostra aos dois só o vencimento, o previsto, o valor pago e o pagador (§2.1).
 */

export interface LinhaFixa {
  id: string;
  descricao: string;
  categoria_id: string;
  categoria: string;
  valor_previsto_centavos: number;
  dia_vencimento: number;
  encerrada_em: string | null;
}

/** Modelos do lar (A view despesas_fixas): ativas primeiro, depois por descrição. Encerradas entram. */
export async function listarFixasDoLar(db: Kysely<DB>, larId: string): Promise<LinhaFixa[]> {
  const r = await sql<Omit<LinhaFixa, 'valor_previsto_centavos'> & { previsto: string }>`
    select f.id, f.descricao, f.categoria_id, c.nome as categoria, f.valor_previsto_centavos::text as previsto,
           f.dia_vencimento::int as dia_vencimento, f.encerrada_em::text as encerrada_em
      from app.despesa_fixa f
      join app.categoria c on c.id = f.categoria_id
     where f.lar_id = ${larId}
     order by f.encerrada_em is not null, f.descricao, f.id`.execute(db);
  return r.rows.map(({ previsto, ...f }) => ({ ...f, valor_previsto_centavos: Number(previsto) }));
}

export interface FixaGravada {
  id: string;
  inicio: string;
  encerrada_em: string | null;
}

/** A fixa do lar, travada até o fim da transação (nula se inexistente ou de outro lar). */
export async function buscarFixaDoLar(
  db: Kysely<DB>,
  dados: { id: string; larId: string },
): Promise<FixaGravada | null> {
  const r = await sql<FixaGravada>`
    select id, inicio::text as inicio, encerrada_em::text as encerrada_em
      from app.despesa_fixa where id = ${dados.id} and lar_id = ${dados.larId} for update`.execute(db);
  return r.rows[0] ?? null;
}

/** Cria a fixa se o id está livre; `false` se o id já existe (em outro lar: a RLS o esconde). */
export async function inserirFixaSeLivre(
  db: Kysely<DB>,
  dados: {
    id: string;
    larId: string;
    descricao: string;
    categoriaId: string;
    valorPrevistoCentavos: number;
    diaVencimento: number;
    inicio: string;
    agora: Date;
  },
): Promise<boolean> {
  const r = await sql`
    insert into app.despesa_fixa (id, lar_id, descricao, categoria_id, valor_previsto_centavos, dia_vencimento, inicio,
                                  criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.descricao}, ${dados.categoriaId}, ${dados.valorPrevistoCentavos},
            ${dados.diaVencimento}, ${dados.inicio}::date, ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

export async function atualizarFixa(
  db: Kysely<DB>,
  dados: {
    id: string;
    larId: string;
    descricao: string;
    categoriaId: string;
    valorPrevistoCentavos: number;
    diaVencimento: number;
  },
): Promise<void> {
  await sql`
    update app.despesa_fixa
       set descricao = ${dados.descricao}, categoria_id = ${dados.categoriaId},
           valor_previsto_centavos = ${dados.valorPrevistoCentavos}, dia_vencimento = ${dados.diaVencimento}
     where id = ${dados.id} and lar_id = ${dados.larId}`.execute(db);
}

/** Ocorrências pendentes da fixa a partir do mês dado (inclusive): as que a edição do modelo atualiza. */
export async function pendentesDaFixaDesde(
  db: Kysely<DB>,
  dados: { fixaId: string; larId: string; desde: string },
): Promise<{ id: string; mes: string }[]> {
  const r = await sql<{ id: string; mes: string }>`
    select id, mes::text as mes from app.ocorrencia_fixa
     where despesa_fixa_id = ${dados.fixaId} and lar_id = ${dados.larId} and lancamento_id is null
       and mes >= ${dados.desde}::date
     order by mes`.execute(db);
  return r.rows;
}

export async function atualizarOcorrenciaPendente(
  db: Kysely<DB>,
  dados: { id: string; larId: string; vencimento: string; valorPrevistoCentavos: number },
): Promise<void> {
  await sql`
    update app.ocorrencia_fixa set vencimento = ${dados.vencimento}::date, valor_previsto_centavos = ${dados.valorPrevistoCentavos}
     where id = ${dados.id} and lar_id = ${dados.larId} and lancamento_id is null`.execute(db);
}

/** Grava `encerrada_em` só na primeira vez (chamar de novo não move a data; CA-T3.5). Nulo se não é do lar. */
export async function encerrarFixa(
  db: Kysely<DB>,
  dados: { id: string; larId: string; hoje: string },
): Promise<{ encerrada_em: string } | null> {
  const r = await sql<{ encerrada_em: string }>`
    update app.despesa_fixa set encerrada_em = coalesce(encerrada_em, ${dados.hoje}::date)
     where id = ${dados.id} and lar_id = ${dados.larId}
     returning encerrada_em::text as encerrada_em`.execute(db);
  return r.rows[0] ?? null;
}

/** Apaga as ocorrências PENDENTES da fixa depois do mês dado (pagas nunca são apagadas; CA-15.4). */
export async function apagarPendentesDepoisDe(
  db: Kysely<DB>,
  dados: { fixaId: string; larId: string; mes: string },
): Promise<void> {
  await sql`
    delete from app.ocorrencia_fixa
     where despesa_fixa_id = ${dados.fixaId} and lar_id = ${dados.larId} and lancamento_id is null
       and mes > ${dados.mes}::date`.execute(db);
}

export interface FixaParaGerarLinha {
  id: string;
  inicio: string;
  encerrada_em: string | null;
  dia_vencimento: number;
  valor_previsto_centavos: number;
}

/** Modelos do lar que podem gerar no mês (o domínio decide em definitivo; aqui só corta o óbvio). */
export async function fixasQuePodemGerar(
  db: Kysely<DB>,
  dados: { larId: string; mes: string },
): Promise<FixaParaGerarLinha[]> {
  const r = await sql<Omit<FixaParaGerarLinha, 'valor_previsto_centavos'> & { previsto: string }>`
    select id, inicio::text as inicio, encerrada_em::text as encerrada_em, dia_vencimento::int as dia_vencimento,
           valor_previsto_centavos::text as previsto
      from app.despesa_fixa
     where lar_id = ${dados.larId} and inicio <= ${dados.mes}::date
       and (encerrada_em is null or encerrada_em >= ${dados.mes}::date)`.execute(db);
  return r.rows.map(({ previsto, ...f }) => ({ ...f, valor_previsto_centavos: Number(previsto) }));
}

/**
 * Grava em lote as ocorrências do mês (SDD 10): `INSERT … SELECT … ON CONFLICT DO NOTHING`. Idempotente também sob
 * concorrência (CA-15.1): a ocorrência já gerada não é corrigida.
 */
export async function inserirOcorrencias(
  db: Kysely<DB>,
  dados: {
    larId: string;
    ocorrencias: readonly { fixaId: string; mes: string; vencimento: string; valorPrevistoCentavos: number }[];
  },
): Promise<void> {
  if (dados.ocorrencias.length === 0) return;
  const fixas = dados.ocorrencias.map((o) => o.fixaId);
  const meses = dados.ocorrencias.map((o) => o.mes);
  const vencimentos = dados.ocorrencias.map((o) => o.vencimento);
  const previstos = dados.ocorrencias.map((o) => String(o.valorPrevistoCentavos));
  await sql`
    insert into app.ocorrencia_fixa (lar_id, despesa_fixa_id, mes, vencimento, valor_previsto_centavos)
    select ${dados.larId}, x.fixa, x.mes, x.vencimento, x.previsto
      from unnest(${fixas}::uuid[], ${meses}::date[], ${vencimentos}::date[], ${previstos}::bigint[])
           as x(fixa, mes, vencimento, previsto)
    on conflict (despesa_fixa_id, mes) do nothing`.execute(db);
}

export interface OcorrenciaLinha {
  id: string;
  despesa_fixa_id: string;
  descricao: string;
  categoria: string;
  vencimento: string;
  valor_previsto_centavos: number;
  valor_pago_centavos: number | null;
  paga: boolean;
  pagador_id: string | null;
  pagador_nome: string | null;
}

/**
 * Ocorrências do mês com o valor pago (soma das parcelas do lançamento ligado) e o pagador (F ocorrencias_do_mes.sql).
 * Nenhum dado privado do pagamento é lido (§2.1). A situação e a ordem são do domínio.
 */
export async function ocorrenciasDoMes(
  db: Kysely<DB>,
  dados: { larId: string; mes: string },
): Promise<OcorrenciaLinha[]> {
  const r = await sql<
    Omit<OcorrenciaLinha, 'valor_previsto_centavos' | 'valor_pago_centavos'> & {
      previsto: string;
      pago: string | null;
    }
  >`
    select o.id, o.despesa_fixa_id, f.descricao, c.nome as categoria, o.vencimento::text as vencimento,
           o.valor_previsto_centavos::text as previsto,
           (select sum(p.valor_centavos) from app.parcela p where p.lancamento_id = l.id)::text as pago,
           o.lancamento_id is not null as paga, l.dono_id as pagador_id, m.nome as pagador_nome
      from app.ocorrencia_fixa o
      join app.despesa_fixa f on f.id = o.despesa_fixa_id
      join app.categoria c on c.id = f.categoria_id
      left join app.lancamento l on l.id = o.lancamento_id
      left join app.membro m on m.id = l.dono_id
     where o.lar_id = ${dados.larId} and o.mes = ${dados.mes}::date`.execute(db);
  return r.rows.map(({ previsto, pago, ...o }) => ({
    ...o,
    valor_previsto_centavos: Number(previsto),
    valor_pago_centavos: pago === null ? null : Number(pago),
  }));
}

export interface OcorrenciaParaPagar {
  id: string;
  vencimento: string;
  valor_previsto_centavos: number;
  lancamento_id: string | null;
  categoria_id: string;
  descricao: string;
}

/** A ocorrência do lar com o modelo, travada (serializa pagamentos e desfazimentos concorrentes). */
export async function buscarOcorrenciaDoLar(
  db: Kysely<DB>,
  dados: { id: string; larId: string },
): Promise<OcorrenciaParaPagar | null> {
  const r = await sql<Omit<OcorrenciaParaPagar, 'valor_previsto_centavos'> & { previsto: string }>`
    select o.id, o.vencimento::text as vencimento, o.valor_previsto_centavos::text as previsto, o.lancamento_id,
           f.categoria_id, f.descricao
      from app.ocorrencia_fixa o
      join app.despesa_fixa f on f.id = o.despesa_fixa_id
     where o.id = ${dados.id} and o.lar_id = ${dados.larId}
     for update of o`.execute(db);
  const o = r.rows[0];
  if (!o) return null;
  const { previsto, ...resto } = o;
  return { ...resto, valor_previsto_centavos: Number(previsto) };
}

/** Liga o lançamento à ocorrência: ela passa a `paga`. */
export async function ligarPagamento(
  db: Kysely<DB>,
  dados: { ocorrenciaId: string; larId: string; lancamentoId: string },
): Promise<void> {
  await sql`
    update app.ocorrencia_fixa set lancamento_id = ${dados.lancamentoId}
     where id = ${dados.ocorrenciaId} and lar_id = ${dados.larId}`.execute(db);
}

/**
 * A ocorrência paga pelo lançamento, se ele é o pagamento de uma fixa (RN-28). É o que liga as regras da fixa na
 * edição, no ajuste de parcela e na exclusão.
 */
export async function ocorrenciaDoLancamento(
  db: Kysely<DB>,
  dados: { lancamentoId: string; larId: string },
): Promise<{ id: string; vencimento: string } | null> {
  const r = await sql<{ id: string; vencimento: string }>`
    select id, vencimento::text as vencimento from app.ocorrencia_fixa
     where lancamento_id = ${dados.lancamentoId} and lar_id = ${dados.larId}`.execute(db);
  return r.rows[0] ?? null;
}

export interface PagamentoGravado {
  ocorrencia_id: string;
  lancamento_id: string;
  valor_pago_centavos: number;
  vencimento: string;
}

/** O pagamento gravado da ocorrência (A resposta_pagamento_ocorrencia.sql): sem forma, conta nem data (§2.1). */
export async function pagamentoGravado(
  db: Kysely<DB>,
  dados: { ocorrenciaId: string; larId: string },
): Promise<PagamentoGravado | null> {
  const r = await sql<Omit<PagamentoGravado, 'valor_pago_centavos'> & { pago: string }>`
    select o.id as ocorrencia_id, o.lancamento_id, o.vencimento::text as vencimento,
           (select sum(p.valor_centavos) from app.parcela p where p.lancamento_id = o.lancamento_id)::text as pago
      from app.ocorrencia_fixa o
     where o.id = ${dados.ocorrenciaId} and o.lar_id = ${dados.larId} and o.lancamento_id is not null`.execute(db);
  const o = r.rows[0];
  if (!o) return null;
  const { pago, ...resto } = o;
  return { ...resto, valor_pago_centavos: Number(pago) };
}
