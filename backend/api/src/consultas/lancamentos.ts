import { sql, type Kysely } from 'kysely';
import type { DB } from '../infraestrutura/db/tipos';

/**
 * Leituras dos lançamentos (ADR-003: agregação em SQL). Visibilidade pela RLS e, de novo, por filtro explícito de
 * lar, escopo e dono (CA-T1.4). Totais somam PARCELAS pelo mês da `parcela.data`, nunca o cabeçalho (G-51).
 */

type Escopo = 'conjunto' | 'individual';
type TipoLancamento = 'despesa' | 'receita';
type TipoForma = 'pix' | 'debito' | 'credito';

export interface CabecalhoDetalhe {
  id: string;
  tipo: TipoLancamento;
  escopo: Escopo;
  descricao: string | null;
  categoria_id: string;
  categoria_nome: string;
  categoria_escopo: Escopo;
  valor_total_centavos: number;
  num_parcelas: number;
  pagador_id: string;
  pagador_nome: string;
  alterado_por_nome: string | null;
  alterado_em: Date | null;
}

/** Cabeçalho do detalhe (A lancamento.sql): o lançamento visível, com categoria, pagador e quem alterou. */
export async function cabecalhoDoDetalhe(
  db: Kysely<DB>,
  dados: { id: string; larId: string; membroId: string },
): Promise<CabecalhoDetalhe | null> {
  const r = await sql<Omit<CabecalhoDetalhe, 'valor_total_centavos'> & { valor: string }>`
    select l.id, l.tipo, l.escopo, l.descricao, c.id as categoria_id, c.nome as categoria_nome,
           c.escopo as categoria_escopo, l.valor_total_centavos::text as valor, l.num_parcelas::int as num_parcelas,
           m.id as pagador_id, m.nome as pagador_nome, ma.nome as alterado_por_nome, l.alterado_em
      from app.lancamento l
      join app.categoria c on c.id = l.categoria_id
      join app.membro m on m.id = l.dono_id
      left join app.membro ma on ma.id = l.alterado_por
     where l.id = ${dados.id} and l.lar_id = ${dados.larId}
       and (l.escopo = 'conjunto' or l.dono_id = ${dados.membroId})`.execute(db);
  const l = r.rows[0];
  if (!l) return null;
  const { valor, ...resto } = l;
  return { ...resto, valor_total_centavos: Number(valor) };
}

export interface PagamentoDetalhe {
  forma_id: string | null;
  forma_nome: string | null;
  forma_tipo: TipoForma | null;
  conta_id: string | null;
  conta_nome: string | null;
  data_operacao: string;
  dia_vencimento_aplicado: number | null;
}

/** Parte privada para o detalhe: só do próprio dono (2ª camada além da RLS; RN-04). */
export async function pagamentoDoDetalhe(
  db: Kysely<DB>,
  dados: { lancamentoId: string; donoId: string },
): Promise<PagamentoDetalhe | null> {
  const r = await sql<PagamentoDetalhe>`
    select f.id as forma_id, f.nome as forma_nome, f.tipo as forma_tipo, ct.id as conta_id, ct.nome as conta_nome,
           lp.data_operacao::text as data_operacao, lp.dia_vencimento_aplicado::int as dia_vencimento_aplicado
      from app.lancamento_pagamento lp
      left join app.forma_pagamento f on f.id = lp.forma_pagamento_id and f.dono_id = lp.dono_id
      left join app.conta ct on ct.id = lp.conta_id and ct.dono_id = lp.dono_id
     where lp.lancamento_id = ${dados.lancamentoId} and lp.dono_id = ${dados.donoId}`.execute(db);
  return r.rows[0] ?? null;
}

export interface ItemDoMes {
  parcela_id: string;
  lancamento_id: string;
  data: string;
  descricao: string | null;
  tipo: TipoLancamento;
  escopo: Escopo;
  categoria_id: string;
  categoria_nome: string;
  variavel: boolean | null;
  valor_centavos: number;
  parcela_numero: number;
  total_parcelas: number;
  pagador_id: string;
  pagador_nome: string;
}

/**
 * Parcelas visíveis do mês com os filtros (A lancamentos_mes.sql; RN-02, CA-02.1, CA-P.2). O filtro de forma só
 * casa com a parte privada do próprio membro: a forma de outro dá lista vazia, sem erro. Ordem: data desc, lançado
 * por último primeiro, número da parcela.
 */
export async function itensDoMes(
  db: Kysely<DB>,
  dados: {
    larId: string;
    membroId: string;
    mes: string;
    escopo: Escopo | null;
    categoriaId: string | null;
    formaId: string | null;
    variavel: boolean | null;
  },
): Promise<ItemDoMes[]> {
  const r = await sql<Omit<ItemDoMes, 'valor_centavos'> & { valor: string }>`
    select p.id as parcela_id, l.id as lancamento_id, p.data::text as data, l.descricao, l.tipo, l.escopo,
           c.id as categoria_id, c.nome as categoria_nome, c.variavel, p.valor_centavos::text as valor,
           p.numero::int as parcela_numero, l.num_parcelas::int as total_parcelas,
           m.id as pagador_id, m.nome as pagador_nome
      from app.parcela p
      join app.lancamento l on l.id = p.lancamento_id
      join app.categoria c on c.id = l.categoria_id
      join app.membro m on m.id = l.dono_id
     where l.lar_id = ${dados.larId}
       and (l.escopo = 'conjunto' or l.dono_id = ${dados.membroId})
       and p.data >= ${dados.mes}::date and p.data < (${dados.mes}::date + interval '1 month')
       and (${dados.escopo}::text is null or l.escopo = ${dados.escopo})
       and (${dados.categoriaId}::uuid is null or l.categoria_id = ${dados.categoriaId})
       and (${dados.variavel}::boolean is null or c.variavel = ${dados.variavel})
       and (${dados.formaId}::uuid is null or exists (
             select 1 from app.lancamento_pagamento lp
              where lp.lancamento_id = l.id and lp.forma_pagamento_id = ${dados.formaId}
                and lp.dono_id = ${dados.membroId}))
     order by p.data desc, l.criado_em desc, p.numero`.execute(db);
  return r.rows.map(({ valor, ...i }) => ({ ...i, valor_centavos: Number(valor) }));
}

export interface DadosDoLancamento {
  categorias_despesa: { id: string; nome: string; escopo: Escopo; variavel: boolean }[];
  categorias_receita: { id: string; nome: string; escopo: Escopo }[];
  formas: { id: string; nome: string; tipo: TipoForma; preferida: boolean }[];
  forma_padrao_id: string | null;
  contas: { id: string; nome: string }[];
  conta_receita_padrao_id: string | null;
}

/**
 * Opções e padrões do lançamento rápido (A dados_lancamento.sql; RN-01, CA-01.4, CA-01.5). Categorias de despesa
 * ordenadas pelo uso do PRÓPRIO membro (as conjuntas lançadas pelo outro não contam), empate por nome; forma padrão
 * = a preferida não arquivada, senão a da despesa mais recente dele com forma não arquivada; conta padrão da
 * receita = a da receita mais recente dele.
 */
export async function dadosDoLancamento(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string },
): Promise<DadosDoLancamento> {
  const { larId, membroId } = dados;
  const categoriasDespesa = await sql<{ id: string; nome: string; escopo: Escopo; variavel: boolean }>`
    select c.id, c.nome, c.escopo, coalesce(c.variavel, false) as variavel
      from app.categoria c
      left join (select l.categoria_id, count(*) as usos from app.lancamento l
                  where l.dono_id = ${membroId} and l.tipo = 'despesa' group by l.categoria_id) u
             on u.categoria_id = c.id
     where c.lar_id = ${larId} and (c.escopo = 'conjunto' or c.dono_id = ${membroId})
       and c.tipo = 'despesa' and not c.arquivada
     order by coalesce(u.usos, 0) desc, c.nome, c.id`.execute(db);
  const categoriasReceita = await sql<{ id: string; nome: string; escopo: Escopo }>`
    select c.id, c.nome, c.escopo from app.categoria c
     where c.lar_id = ${larId} and c.dono_id = ${membroId} and c.tipo = 'receita' and not c.arquivada
     order by c.nome, c.id`.execute(db);
  const formas = await sql<{ id: string; nome: string; tipo: TipoForma; preferida: boolean }>`
    select f.id, f.nome, f.tipo, f.preferida from app.forma_pagamento f
     where f.dono_id = ${membroId} and not f.arquivada order by f.nome, f.id`.execute(db);
  const contas = await sql<{ id: string; nome: string }>`
    select c.id, c.nome from app.conta c where c.dono_id = ${membroId} and not c.arquivada order by c.nome, c.id`.execute(
    db,
  );
  const padroes = await sql<{ forma_padrao_id: string | null; conta_receita_padrao_id: string | null }>`
    select coalesce(
             (select f.id from app.forma_pagamento f
               where f.dono_id = ${membroId} and f.preferida and not f.arquivada limit 1),
             (select f.id from app.lancamento l
                join app.lancamento_pagamento lp on lp.lancamento_id = l.id and lp.dono_id = ${membroId}
                join app.forma_pagamento f on f.id = lp.forma_pagamento_id and f.dono_id = ${membroId}
               where l.dono_id = ${membroId} and l.tipo = 'despesa' and not f.arquivada
               order by l.criado_em desc, l.id desc limit 1)) as forma_padrao_id,
           (select ct.id from app.lancamento l
              join app.lancamento_pagamento lp on lp.lancamento_id = l.id and lp.dono_id = ${membroId}
              join app.conta ct on ct.id = lp.conta_id and ct.dono_id = ${membroId}
             where l.dono_id = ${membroId} and l.tipo = 'receita' and not ct.arquivada
             order by l.criado_em desc, l.id desc limit 1) as conta_receita_padrao_id`.execute(db);
  return {
    categorias_despesa: categoriasDespesa.rows,
    categorias_receita: categoriasReceita.rows,
    formas: formas.rows,
    forma_padrao_id: padroes.rows[0]?.forma_padrao_id ?? null,
    contas: contas.rows,
    conta_receita_padrao_id: padroes.rows[0]?.conta_receita_padrao_id ?? null,
  };
}
