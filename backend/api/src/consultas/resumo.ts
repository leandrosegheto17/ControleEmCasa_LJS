import { sql, type Kysely } from 'kysely';
import type { DB } from '../infraestrutura/db/tipos';

/**
 * Totais do resumo do mês (RN-16a a RN-16e; F totais_conjunto.sql, totais_individuais.sql, totais_por_categoria.sql):
 * agregação em SQL (ADR-003; SDD 10). A competência é o mês da DATA DA PARCELA, e a soma é das parcelas, nunca do
 * cabeçalho (G-51). Os filtros de tipo, escopo e dono são explícitos, além da RLS (CA-T1.4, RN-16e): só entram as
 * conjuntas do lar e o que é do próprio membro. Forma, conta e data da operação não entram em nada.
 */

export interface SomaPorCategoria {
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
  /** A parcela é do membro que consulta (pagador da conjunta ou dono do individual). */
  minha: boolean;
  categoria_id: string;
  nome: string;
  variavel: boolean;
  total_centavos: number;
}

/**
 * Σ parcelas do mês por (tipo, escopo, é minha, categoria): uma linha por grupo, poucas dezenas no máximo. Os blocos
 * do resumo (total do casal, minha parte, meu individual, receitas, por categoria) saem destas linhas sem reler as
 * parcelas. O individual do outro membro não entra (filtro por dono), nem por soma.
 */
export async function somasDoMesPorCategoria(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string; mes: string },
): Promise<SomaPorCategoria[]> {
  const r = await sql<Omit<SomaPorCategoria, 'total_centavos'> & { total: string }>`
    select l.tipo, p.escopo, p.dono_id = ${dados.membroId} as minha, c.id as categoria_id, c.nome,
           coalesce(c.variavel, false) as variavel, sum(p.valor_centavos)::text as total
      from app.parcela p
      join app.lancamento l on l.id = p.lancamento_id
      join app.categoria c on c.id = l.categoria_id
     where p.lar_id = ${dados.larId}
       and p.data >= ${dados.mes}::date and p.data < ${dados.mes}::date + interval '1 month'
       and (p.escopo = 'conjunto' or p.dono_id = ${dados.membroId})
       and (l.tipo = 'despesa' or (l.tipo = 'receita' and p.dono_id = ${dados.membroId}))
     -- Por posição: a comparação com o membro no select e num group by teria parâmetros diferentes.
     group by 1, 2, 3, 4, 5, 6`.execute(db);
  return r.rows.map(({ total, ...x }) => ({ ...x, total_centavos: Number(total) }));
}

export interface PagoPorMembroLinha {
  membro_id: string;
  nome: string;
  valor_centavos: number;
}

/**
 * Quanto cada membro pagou das despesas conjuntas do mês (RN-16a; CA-16.1 a CA-16.3, CA-11.3), na ordem de entrada
 * no lar (o titular primeiro, depois por entrada). Entram os membros ativos (com 0 se não pagaram nada) e os ex-membros que pagaram algo
 * no mês (as conjuntas que pagaram ficam no lar, CA-23.12). Só dados conjuntos e pagadores já visíveis (RN-16e).
 */
export async function pagoPorMembroDoMes(
  db: Kysely<DB>,
  dados: { larId: string; mes: string },
): Promise<PagoPorMembroLinha[]> {
  const r = await sql<{ membro_id: string; nome: string; valor: string }>`
    with conj as (
      select p.dono_id, sum(p.valor_centavos) as valor
        from app.parcela p
        join app.lancamento l on l.id = p.lancamento_id
       where p.lar_id = ${dados.larId} and p.escopo = 'conjunto' and l.tipo = 'despesa'
         and p.data >= ${dados.mes}::date and p.data < ${dados.mes}::date + interval '1 month'
       group by p.dono_id
    )
    select m.id as membro_id, m.nome, coalesce(conj.valor, 0)::text as valor
      from app.membro m
      left join conj on conj.dono_id = m.id
     where m.lar_id = ${dados.larId} and (m.saiu_em is null or coalesce(conj.valor, 0) > 0)
     order by m.papel = 'titular' desc, m.entrou_em, m.id`.execute(db);
  return r.rows.map(({ valor, ...m }) => ({ ...m, valor_centavos: Number(valor) }));
}
