import { sql, type Kysely } from 'kysely';
import type { DB } from '../infraestrutura/db/tipos';

/**
 * Orçado × realizado do mês (RN-16 "Orçamento"; F orcado_realizado.sql): agregação em SQL (ADR-003; SDD 10). O
 * realizado é a soma das PARCELAS de despesa com data no mês, nunca o valor do cabeçalho (G-51; CA-16.5). Os
 * filtros de escopo e dono são explícitos além da RLS (CA-T1.4, RN-16e): no individual só entram as despesas
 * individuais do próprio membro (a parte dele nas conjuntas não entra, RN-16c).
 */

export type Escopo = 'conjunto' | 'individual';

export interface LinhaOrcadoRealizado {
  categoria_id: string;
  nome: string;
  /** Nulo: a categoria tem gasto no mês, mas nenhum orçamento. */
  orcado_centavos: number | null;
  realizado_centavos: number;
}

/**
 * Uma linha por categoria que tem orçamento OU despesa no mês, no escopo. O total realizado do escopo é a soma de
 * TODAS as linhas (orçadas ou não; CA-16.6) e as linhas do orçamento são as de `orcado_centavos` não nulo.
 */
export async function orcadoRealizadoDoEscopo(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string; mes: string; escopo: Escopo },
): Promise<LinhaOrcadoRealizado[]> {
  const r = await sql<{ categoria_id: string; nome: string; orcado: string | null; realizado: string }>`
    with desp as (
      select l.categoria_id, sum(p.valor_centavos) as v
        from app.parcela p
        join app.lancamento l on l.id = p.lancamento_id
       where p.lar_id = ${dados.larId} and l.tipo = 'despesa' and p.escopo = ${dados.escopo}
         and (p.escopo = 'conjunto' or p.dono_id = ${dados.membroId})
         and p.data >= ${dados.mes}::date and p.data < ${dados.mes}::date + interval '1 month'
       group by l.categoria_id
    ), orc as (
      select o.categoria_id, o.valor_centavos
        from app.orcamento o
       where o.lar_id = ${dados.larId} and o.mes = ${dados.mes}::date and o.escopo = ${dados.escopo}
         and (o.escopo = 'conjunto' or o.dono_id = ${dados.membroId})
    )
    select c.id as categoria_id, c.nome, orc.valor_centavos::text as orcado, coalesce(desp.v, 0)::text as realizado
      from orc
      full join desp on desp.categoria_id = orc.categoria_id
      join app.categoria c on c.id = coalesce(orc.categoria_id, desp.categoria_id)`.execute(db);
  return r.rows.map((l) => ({
    categoria_id: l.categoria_id,
    nome: l.nome,
    orcado_centavos: l.orcado === null ? null : Number(l.orcado),
    realizado_centavos: Number(l.realizado),
  }));
}

export interface OrcamentosPorMes {
  conjunto: { categorias: number; orcado_centavos: number };
  individual: { categorias: number; orcado_centavos: number };
}

/**
 * Quantas categorias e quanto está orçado em cada escopo, num mês, só do que o membro vê (no individual, só o
 * dele). Decide `pode_copiar_anterior` e o bloco `anterior`.
 */
export async function orcamentosDoMes(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string; mes: string },
): Promise<OrcamentosPorMes> {
  const r = await sql<{ escopo: Escopo; n: number; total: string }>`
    select o.escopo, count(*)::int as n, sum(o.valor_centavos)::text as total
      from app.orcamento o
     where o.lar_id = ${dados.larId} and o.mes = ${dados.mes}::date
       and (o.escopo = 'conjunto' or o.dono_id = ${dados.membroId})
     group by o.escopo`.execute(db);
  const saida: OrcamentosPorMes = {
    conjunto: { categorias: 0, orcado_centavos: 0 },
    individual: { categorias: 0, orcado_centavos: 0 },
  };
  for (const l of r.rows) saida[l.escopo] = { categorias: l.n, orcado_centavos: Number(l.total) };
  return saida;
}

/** Categorias de despesa não arquivadas do escopo sem valor no mês (a tela de orçamento as oferece). */
export async function categoriasSemOrcamento(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string; mes: string; escopo: Escopo },
): Promise<{ categoria_id: string; nome: string }[]> {
  const r = await sql<{ categoria_id: string; nome: string }>`
    select c.id as categoria_id, c.nome
      from app.categoria c
     where c.lar_id = ${dados.larId} and c.tipo = 'despesa' and not c.arquivada and c.escopo = ${dados.escopo}
       and (c.escopo = 'conjunto' or c.dono_id = ${dados.membroId})
       and not exists (select 1 from app.orcamento o where o.categoria_id = c.id and o.mes = ${dados.mes}::date)`.execute(
    db,
  );
  return r.rows;
}
