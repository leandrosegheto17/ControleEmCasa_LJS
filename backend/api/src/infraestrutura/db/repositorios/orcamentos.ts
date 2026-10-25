import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Orçamento por categoria de despesa e mês (SDD 3.5; RN-16). Toda consulta filtra por lar e por "conjunto ou do
 * próprio membro" além da RLS (CA-T1.4: as duas camadas); o orçamento individual do outro nunca é enxergado.
 * Escopo e dono vêm da categoria, nunca do cliente (G-03).
 */

export type Escopo = 'conjunto' | 'individual';

/**
 * Define (cria ou troca o valor) o orçamento da categoria no mês; idempotente (`on conflict`, CA-T3.5). O escopo e
 * o dono são os da categoria (o dono é nulo na conjunta).
 */
export async function gravarOrcamento(
  db: Kysely<DB>,
  dados: {
    larId: string;
    mes: string;
    categoriaId: string;
    escopo: Escopo;
    donoId: string | null;
    valorCentavos: number;
    agora: Date;
  },
): Promise<void> {
  await sql`
    insert into app.orcamento (lar_id, mes, categoria_id, escopo, dono_id, valor_centavos, criado_em)
    values (${dados.larId}, ${dados.mes}::date, ${dados.categoriaId}, ${dados.escopo}, ${dados.donoId},
            ${dados.valorCentavos}, ${dados.agora.toISOString()}::timestamptz)
    on conflict (categoria_id, mes) do update set valor_centavos = excluded.valor_centavos`.execute(db);
}

/** Remove o orçamento da categoria no mês (idempotente: sem orçamento, nada acontece). */
export async function removerOrcamento(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string; mes: string; categoriaId: string },
): Promise<void> {
  await sql`
    delete from app.orcamento
     where lar_id = ${dados.larId} and categoria_id = ${dados.categoriaId} and mes = ${dados.mes}::date
       and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(db);
}

/**
 * Copia o orçamento do mês anterior para o mês, no escopo pedido (RN-16 "Copiar"): não sobrescreve o que o mês já
 * tem e pula categoria arquivada. A origem já se limita ao que o membro vê (no individual, só o dele). Devolve
 * quantas categorias foram copiadas.
 */
export async function copiarOrcamentoDoMesAnterior(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string; mes: string; anterior: string; escopo: Escopo; agora: Date },
): Promise<number> {
  const r = await sql`
    insert into app.orcamento (lar_id, mes, categoria_id, escopo, dono_id, valor_centavos, criado_em)
    select o.lar_id, ${dados.mes}::date, o.categoria_id, o.escopo, o.dono_id, o.valor_centavos,
           ${dados.agora.toISOString()}::timestamptz
      from app.orcamento o
      join app.categoria c on c.id = o.categoria_id and not c.arquivada
     where o.lar_id = ${dados.larId} and o.mes = ${dados.anterior}::date and o.escopo = ${dados.escopo}
       and (o.escopo = 'conjunto' or o.dono_id = ${dados.membroId})
    on conflict (categoria_id, mes) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}
