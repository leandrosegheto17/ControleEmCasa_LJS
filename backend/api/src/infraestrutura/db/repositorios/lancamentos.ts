import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Lançamentos, parte privada e parcelas (SDD 3.5; RN-01, RN-04 a RN-07, RN-14). Toda consulta filtra por lar e
 * por escopo/dono além da RLS (CA-T1.4: as duas camadas). A parte privada (`lancamento_pagamento`) é lida e
 * gravada só pelo dono (G-10): nenhuma função daqui a toca com o id de outro membro.
 */

export type Escopo = 'conjunto' | 'individual';
export type TipoLancamento = 'despesa' | 'receita';
export type TipoForma = 'pix' | 'debito' | 'credito';

export interface LancamentoVisivel {
  id: string;
  dono_id: string;
  tipo: TipoLancamento;
  escopo: Escopo;
  categoria_id: string;
  descricao: string | null;
  valor_total_centavos: number;
  num_parcelas: number;
}

/**
 * O lançamento que o membro enxerga: conjunta do lar ou individual dele (nulo nos demais casos: inexistente, de
 * outro lar ou individual do outro membro dão o mesmo nada; RT-01). `travar` trava a linha até o fim da transação.
 */
export async function buscarLancamentoVisivel(
  db: Kysely<DB>,
  dados: { id: string; larId: string; membroId: string; travar?: boolean },
): Promise<LancamentoVisivel | null> {
  const r = await sql<Omit<LancamentoVisivel, 'valor_total_centavos'> & { valor: string }>`
    select id, dono_id, tipo, escopo, categoria_id, descricao, valor_total_centavos::text as valor,
           num_parcelas::int as num_parcelas
      from app.lancamento
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})
     ${dados.travar ? sql`for update` : sql``}`.execute(db);
  const l = r.rows[0];
  if (!l) return null;
  const { valor, ...resto } = l;
  return { ...resto, valor_total_centavos: Number(valor) };
}

export interface PagamentoDoDono {
  forma_pagamento_id: string | null;
  forma_tipo: TipoForma | null;
  conta_id: string | null;
  data_operacao: string;
  dia_vencimento_aplicado: number | null;
}

/** A parte privada do lançamento, só do próprio dono (nula para qualquer outro; G-10). */
export async function buscarPagamentoDoDono(
  db: Kysely<DB>,
  dados: { lancamentoId: string; donoId: string },
): Promise<PagamentoDoDono | null> {
  const r = await sql<PagamentoDoDono>`
    select lp.forma_pagamento_id, f.tipo as forma_tipo, lp.conta_id, lp.data_operacao::text as data_operacao,
           lp.dia_vencimento_aplicado::int as dia_vencimento_aplicado
      from app.lancamento_pagamento lp
      left join app.forma_pagamento f on f.id = lp.forma_pagamento_id and f.dono_id = lp.dono_id
     where lp.lancamento_id = ${dados.lancamentoId} and lp.dono_id = ${dados.donoId}`.execute(db);
  return r.rows[0] ?? null;
}

export interface ParcelaGravada {
  id: string;
  numero: number;
  valor_centavos: number;
  data: string;
  data_ajustada: boolean;
}

/** Parcelas do lançamento, por número (a RLS e o filtro do chamador já decidiram que ele é visível). */
export async function listarParcelas(db: Kysely<DB>, lancamentoId: string): Promise<ParcelaGravada[]> {
  const r = await sql<Omit<ParcelaGravada, 'valor_centavos'> & { valor: string }>`
    select id, numero::int as numero, valor_centavos::text as valor, data::text as data, data_ajustada
      from app.parcela where lancamento_id = ${lancamentoId} order by numero`.execute(db);
  return r.rows.map(({ valor, ...p }) => ({ ...p, valor_centavos: Number(valor) }));
}

/** Cria o cabeçalho se o id está livre; `false` se o id já existe (do mesmo membro em corrida ou de outro). */
export async function inserirLancamentoSeLivre(
  db: Kysely<DB>,
  dados: {
    id: string;
    larId: string;
    donoId: string;
    tipo: TipoLancamento;
    escopo: Escopo;
    categoriaId: string;
    descricao: string | null;
    valorTotalCentavos: number;
    numParcelas: number;
    agora: Date;
  },
): Promise<boolean> {
  const r = await sql`
    insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, descricao, valor_total_centavos,
                                num_parcelas, criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.donoId}, ${dados.tipo}, ${dados.escopo}, ${dados.categoriaId},
            ${dados.descricao}, ${dados.valorTotalCentavos}, ${dados.numParcelas}, ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

export async function inserirPagamento(
  db: Kysely<DB>,
  dados: {
    lancamentoId: string;
    larId: string;
    donoId: string;
    formaId: string | null;
    contaId: string | null;
    dataOperacao: string;
    diaVencimentoAplicado: number | null;
  },
): Promise<void> {
  await sql`
    insert into app.lancamento_pagamento (lancamento_id, lar_id, dono_id, forma_pagamento_id, conta_id, data_operacao,
                                          dia_vencimento_aplicado)
    values (${dados.lancamentoId}, ${dados.larId}, ${dados.donoId}, ${dados.formaId}, ${dados.contaId},
            ${dados.dataOperacao}::date, ${dados.diaVencimentoAplicado})`.execute(db);
}

export interface ParcelaNova {
  numero: number;
  valorCentavos: number;
  data: string;
}

export async function inserirParcelas(
  db: Kysely<DB>,
  dados: { lancamentoId: string; larId: string; donoId: string; escopo: Escopo; parcelas: readonly ParcelaNova[] },
): Promise<void> {
  for (const p of dados.parcelas) {
    await sql`
      insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
      values (${dados.lancamentoId}, ${dados.larId}, ${dados.escopo}, ${dados.donoId}, ${p.numero}, ${p.valorCentavos},
              ${p.data}::date)`.execute(db);
  }
}

export interface LancamentoResumido {
  id: string;
  escopo: Escopo;
  categoria: string;
  valor_total_centavos: number;
  num_parcelas: number;
  primeira_parcela_data: string;
}

/** O que foi gravado, na forma da resposta de lançar (A resposta_lancamento.sql). Só do próprio dono. */
export async function buscarGravadoDoDono(
  db: Kysely<DB>,
  dados: { id: string; donoId: string },
): Promise<LancamentoResumido | null> {
  const r = await sql<Omit<LancamentoResumido, 'valor_total_centavos'> & { valor: string }>`
    select l.id, l.escopo, c.nome as categoria, l.valor_total_centavos::text as valor,
           l.num_parcelas::int as num_parcelas, p.data::text as primeira_parcela_data
      from app.lancamento l
      join app.categoria c on c.id = l.categoria_id
      join app.parcela p on p.lancamento_id = l.id and p.numero = 1
     where l.id = ${dados.id} and l.dono_id = ${dados.donoId}`.execute(db);
  const l = r.rows[0];
  if (!l) return null;
  const { valor, ...resto } = l;
  return { ...resto, valor_total_centavos: Number(valor) };
}

/**
 * Atualiza o cabeçalho e grava quem alterou e quando (RN-06). A categoria e o escopo mudam juntos (RN-07); as
 * parcelas acompanham o escopo pela cascata da FK. A política de update vale para a conjunta e para o próprio
 * individual (SDD D-04); o `with check` impede o outro membro de torná-la individual.
 */
export async function atualizarLancamento(
  db: Kysely<DB>,
  dados: {
    id: string;
    larId: string;
    categoriaId: string;
    escopo: Escopo;
    descricao: string | null;
    valorTotalCentavos: number;
    numParcelas: number;
    alteradoPor: string;
    agora: Date;
  },
): Promise<void> {
  await sql`
    update app.lancamento
       set categoria_id = ${dados.categoriaId}, escopo = ${dados.escopo}, descricao = ${dados.descricao},
           valor_total_centavos = ${dados.valorTotalCentavos}, num_parcelas = ${dados.numParcelas},
           alterado_por = ${dados.alteradoPor}, alterado_em = ${dados.agora.toISOString()}::timestamptz
     where id = ${dados.id} and lar_id = ${dados.larId}`.execute(db);
}

/** Atualiza a parte privada do próprio dono (forma, conta, data da operação e dia aplicado). */
export async function atualizarPagamentoDoDono(
  db: Kysely<DB>,
  dados: {
    lancamentoId: string;
    donoId: string;
    formaId: string | null;
    contaId: string | null;
    dataOperacao: string;
    diaVencimentoAplicado: number | null;
  },
): Promise<void> {
  await sql`
    update app.lancamento_pagamento
       set forma_pagamento_id = ${dados.formaId}, conta_id = ${dados.contaId}, data_operacao = ${dados.dataOperacao}::date,
           dia_vencimento_aplicado = ${dados.diaVencimentoAplicado}
     where lancamento_id = ${dados.lancamentoId} and dono_id = ${dados.donoId}`.execute(db);
}

/**
 * Recálculo pela RN-14 (CA-06.4, CA-06.5): mantém os ids das parcelas que continuam (mesmo número), apaga as que
 * sobram, cria as que faltam e zera `data_ajustada`.
 */
export async function regravarParcelas(
  db: Kysely<DB>,
  dados: { lancamentoId: string; larId: string; donoId: string; escopo: Escopo; parcelas: readonly ParcelaNova[] },
): Promise<void> {
  const n = dados.parcelas.length;
  await sql`delete from app.parcela where lancamento_id = ${dados.lancamentoId} and numero > ${n}`.execute(db);
  const existentes = new Set(
    (
      await sql<{ numero: number }>`
        select numero::int as numero from app.parcela where lancamento_id = ${dados.lancamentoId}`.execute(db)
    ).rows.map((x) => x.numero),
  );
  for (const p of dados.parcelas) {
    if (existentes.has(p.numero)) {
      await sql`
        update app.parcela set valor_centavos = ${p.valorCentavos}, data = ${p.data}::date, data_ajustada = false
         where lancamento_id = ${dados.lancamentoId} and numero = ${p.numero}`.execute(db);
    }
  }
  await inserirParcelas(db, { ...dados, parcelas: dados.parcelas.filter((p) => !existentes.has(p.numero)) });
}

/** Só os valores das parcelas, por número (datas e ajustes ficam): edição de valor pelo outro membro. */
export async function regravarValoresDasParcelas(
  db: Kysely<DB>,
  dados: { lancamentoId: string; parcelas: readonly { numero: number; valorCentavos: number }[] },
): Promise<void> {
  for (const p of dados.parcelas) {
    await sql`
      update app.parcela set valor_centavos = ${p.valorCentavos}
       where lancamento_id = ${dados.lancamentoId} and numero = ${p.numero}`.execute(db);
  }
}

/** Exclui o lançamento visível; parcelas e parte privada vão junto pela cascata (CA-06.8). Devolve as linhas. */
export async function excluirLancamento(
  db: Kysely<DB>,
  dados: { id: string; larId: string; membroId: string },
): Promise<number> {
  const r = await sql`
    delete from app.lancamento
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(
    db,
  );
  return Number(r.numAffectedRows ?? 0);
}

export interface ParcelaDoDono {
  id: string;
  lancamento_id: string;
  forma_tipo: TipoForma | null;
}

/**
 * A parcela do próprio dono, com o tipo da forma da compra (da parte privada dele). Parcela de outro membro,
 * de outro lar ou inexistente: nula (CA-06.7). Trava a linha.
 */
export async function buscarParcelaDoDono(
  db: Kysely<DB>,
  dados: { id: string; larId: string; donoId: string },
): Promise<ParcelaDoDono | null> {
  const r = await sql<ParcelaDoDono>`
    select p.id, p.lancamento_id, f.tipo as forma_tipo
      from app.parcela p
      left join app.lancamento_pagamento lp on lp.lancamento_id = p.lancamento_id and lp.dono_id = p.dono_id
      left join app.forma_pagamento f on f.id = lp.forma_pagamento_id and f.dono_id = lp.dono_id
     where p.id = ${dados.id} and p.lar_id = ${dados.larId} and p.dono_id = ${dados.donoId}
     for update of p`.execute(db);
  return r.rows[0] ?? null;
}

/** Ajuste manual da data de uma parcela (CA-06.7): marca `data_ajustada`. */
export async function ajustarDataDaParcela(
  db: Kysely<DB>,
  dados: { id: string; donoId: string; data: string },
): Promise<void> {
  await sql`
    update app.parcela set data = ${dados.data}::date, data_ajustada = true
     where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(db);
}

/**
 * Saída voluntária do membro (CA-23.12): apaga a parte privada de todos os lançamentos dele, na hora. As
 * conjuntas que ele pagou ficam no lar com o pagador "Ex-membro"; o individual é purgado em 30 dias (etapa 14).
 * Só o próprio dono consegue (política D de `lancamento_pagamento`).
 */
export async function apagarPartePrivadaDoMembro(db: Kysely<DB>, membroId: string): Promise<void> {
  await sql`delete from app.lancamento_pagamento where dono_id = ${membroId}`.execute(db);
}
