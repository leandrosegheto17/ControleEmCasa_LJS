import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { DB } from '../infraestrutura/db/tipos';

/**
 * Visão do cartão de crédito (RN-13; F gasto_cartao.sql): agregação em SQL (ADR-003; SDD 10).
 * - **gasto no mês** = parcelas da forma com data de cartão no mês;
 * - **comprometido futuro** = parcelas com data de cartão nos meses seguintes.
 * A data de cartão da compra é a data da parcela. O pagamento de fixa no Crédito entra pela data de cartão do
 * pagamento (próximo vencimento depois da data da operação, com o dia congelado; CA-13.3), sem mexer na competência
 * da casa: a parcela fica no vencimento da ocorrência (RN-28). Pagamento de cartão não abate o gasto.
 * Só as formas do próprio dono (a parte privada é dele; G-10): o filtro repete a RLS (CA-T1.4).
 */

/**
 * Data de cartão de uma operação à vista no Crédito: dia `dia` do mês seguinte ao da data, ou o último dia do mês
 * se não existir. Espelho em SQL de `dataDeCartao` do domínio (RN-14, N = 1); o teste compara os dois.
 */
export function dataDeCartaoSql(dataOperacao: RawBuilder<unknown>, dia: RawBuilder<unknown>): RawBuilder<string> {
  return sql<string>`((date_trunc('month', ${dataOperacao}) + interval '1 month')::date
    + (least(${dia}, extract(day from date_trunc('month', ${dataOperacao}) + interval '2 month' - interval '1 day')::int) - 1))`;
}

export interface GastoDoCartao {
  forma_id: string;
  nome: string;
  dia_vencimento: number;
  arquivada: boolean;
  gasto_mes_centavos: number;
  comprometido_futuro_centavos: number;
}

/** Gasto e comprometido de cada forma de Crédito do dono, relativos ao mês dado (dia 1). Arquivadas entram. */
export async function gastoDosCartoes(db: Kysely<DB>, donoId: string, mes: string): Promise<GastoDoCartao[]> {
  const r = await sql<
    Omit<GastoDoCartao, 'gasto_mes_centavos' | 'comprometido_futuro_centavos'> & { gasto: string; futuro: string }
  >`
    with itens as (
      select lp.forma_pagamento_id as forma_id, p.valor_centavos,
             case when o.id is null then p.data
                  else ${dataDeCartaoSql(sql`lp.data_operacao`, sql`lp.dia_vencimento_aplicado`)} end as data_cartao
        from app.lancamento_pagamento lp
        join app.forma_pagamento f on f.id = lp.forma_pagamento_id and f.dono_id = lp.dono_id
        join app.parcela p on p.lancamento_id = lp.lancamento_id and p.dono_id = lp.dono_id
        left join app.ocorrencia_fixa o on o.lancamento_id = lp.lancamento_id
       where lp.dono_id = ${donoId} and f.tipo = 'credito'
    )
    select f.id as forma_id, f.nome, f.dia_vencimento::int as dia_vencimento, f.arquivada,
           coalesce(sum(i.valor_centavos) filter (
             where i.data_cartao >= ${mes}::date and i.data_cartao < ${mes}::date + interval '1 month'), 0)::text as gasto,
           coalesce(sum(i.valor_centavos) filter (
             where i.data_cartao >= ${mes}::date + interval '1 month'), 0)::text as futuro
      from app.forma_pagamento f
      left join itens i on i.forma_id = f.id
     where f.dono_id = ${donoId} and f.tipo = 'credito'
     group by f.id
     order by f.nome, f.id`.execute(db);
  return r.rows.map(({ gasto, futuro, ...f }) => ({
    ...f,
    gasto_mes_centavos: Number(gasto),
    comprometido_futuro_centavos: Number(futuro),
  }));
}
