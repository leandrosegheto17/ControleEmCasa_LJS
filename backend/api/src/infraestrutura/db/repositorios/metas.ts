import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Metas e seus movimentos (SDD 3.5; RN-08, RN-09). Toda consulta filtra por lar e por "conjunta ou do próprio
 * membro" além da RLS (CA-T1.4: as duas camadas); a meta individual do outro nunca é enxergada. O movimento de
 * meta é imutável: a app só lê e insere. O lar e o autor vêm do vínculo derivado no banco, nunca do cliente (G-03).
 */

export type Escopo = 'conjunto' | 'individual';
export type TipoMovimento = 'aporte' | 'retirada';

export interface Visao {
  larId: string;
  membroId: string;
}

export interface MetaGravada {
  id: string;
  nome: string;
  escopo: Escopo;
  alvo_centavos: number;
  /** `AAAA-MM-DD` (dia 1) ou nulo. */
  prazo: string | null;
  atingida_em: string | null;
  /** Σ aportes − Σ retiradas, em todos os locais. */
  guardado_centavos: number;
}

interface LinhaMeta {
  id: string;
  nome: string;
  escopo: Escopo;
  alvo: string;
  prazo: string | null;
  atingida_em: string | null;
  guardado: string;
}

const paraMeta = (l: LinhaMeta): MetaGravada => ({
  id: l.id,
  nome: l.nome,
  escopo: l.escopo,
  alvo_centavos: Number(l.alvo),
  prazo: l.prazo,
  atingida_em: l.atingida_em,
  guardado_centavos: Number(l.guardado),
});

/** As metas que o membro enxerga, com o guardado já somado (uma consulta; o progresso é do domínio). */
export async function listarMetasVisiveis(db: Kysely<DB>, visao: Visao): Promise<MetaGravada[]> {
  const r = await sql<LinhaMeta>`
    select m.id, m.nome, m.escopo, m.alvo_centavos::text as alvo, m.prazo::text as prazo,
           m.atingida_em::text as atingida_em,
           coalesce((select sum(case mm.tipo when 'aporte' then mm.valor_centavos else -mm.valor_centavos end)
                       from app.movimento_meta mm where mm.meta_id = m.id), 0)::text as guardado
      from app.meta m
     where m.lar_id = ${visao.larId} and (m.escopo = 'conjunto' or m.dono_id = ${visao.membroId})
     order by m.nome, m.id`.execute(db);
  return r.rows.map(paraMeta);
}

/**
 * A meta visível ao membro, com o guardado (nula se inexistente, de outro lar ou individual do outro). Com
 * `travar`, a linha da meta fica travada até o fim da transação: serializa as retiradas simultâneas (CA-09.2).
 */
export async function buscarMetaVisivel(
  db: Kysely<DB>,
  dados: Visao & { id: string; travar?: boolean },
): Promise<MetaGravada | null> {
  const r = await sql<LinhaMeta>`
    select m.id, m.nome, m.escopo, m.alvo_centavos::text as alvo, m.prazo::text as prazo,
           m.atingida_em::text as atingida_em,
           coalesce((select sum(case mm.tipo when 'aporte' then mm.valor_centavos else -mm.valor_centavos end)
                       from app.movimento_meta mm where mm.meta_id = m.id), 0)::text as guardado
      from app.meta m
     where m.id = ${dados.id} and m.lar_id = ${dados.larId} and (m.escopo = 'conjunto' or m.dono_id = ${dados.membroId})
     ${dados.travar ? sql`for update of m` : sql``}`.execute(db);
  return r.rows[0] ? paraMeta(r.rows[0]) : null;
}

/** Guardado por local, só os com saldo > 0, do maior saldo para o menor e depois por local (RN-08). */
export async function guardadoPorLocal(
  db: Kysely<DB>,
  metaId: string,
): Promise<{ local: string; guardado_centavos: number }[]> {
  const r = await sql<{ local: string; saldo: string }>`
    select mm.local, sum(case mm.tipo when 'aporte' then mm.valor_centavos else -mm.valor_centavos end)::text as saldo
      from app.movimento_meta mm
     where mm.meta_id = ${metaId}
     group by mm.local
    having sum(case mm.tipo when 'aporte' then mm.valor_centavos else -mm.valor_centavos end) > 0
     order by sum(case mm.tipo when 'aporte' then mm.valor_centavos else -mm.valor_centavos end) desc, mm.local`.execute(
    db,
  );
  return r.rows.map((l) => ({ local: l.local, guardado_centavos: Number(l.saldo) }));
}

/** Guardado naquele local (0 se o local nunca foi usado): o limite da retirada (RN-09). */
export async function guardadoNoLocal(db: Kysely<DB>, dados: { metaId: string; local: string }): Promise<number> {
  const r = await sql<{ saldo: string }>`
    select coalesce(sum(case mm.tipo when 'aporte' then mm.valor_centavos else -mm.valor_centavos end), 0)::text as saldo
      from app.movimento_meta mm
     where mm.meta_id = ${dados.metaId} and mm.local = ${dados.local}`.execute(db);
  return Number(r.rows[0]?.saldo ?? 0);
}

/** Cria a meta se o id está livre; `false` se o id já existe (em outro lar ou individual do outro: a RLS o esconde). */
export async function inserirMetaSeLivre(
  db: Kysely<DB>,
  dados: Visao & {
    id: string;
    nome: string;
    alvoCentavos: number;
    prazo: string | null;
    escopo: Escopo;
    agora: Date;
  },
): Promise<boolean> {
  const r = await sql`
    insert into app.meta (id, lar_id, dono_id, nome, alvo_centavos, prazo, escopo, criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.membroId}, ${dados.nome}, ${dados.alvoCentavos},
            ${dados.prazo}::date, ${dados.escopo}, ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

/** Edita nome, alvo e prazo (o escopo nunca muda: sem grant de update; RN-08). */
export async function atualizarMeta(
  db: Kysely<DB>,
  dados: Visao & { id: string; nome: string; alvoCentavos: number; prazo: string | null },
): Promise<void> {
  await sql`
    update app.meta set nome = ${dados.nome}, alvo_centavos = ${dados.alvoCentavos}, prazo = ${dados.prazo}::date
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(
    db,
  );
}

/** Grava `atingida_em` (data ou nulo), decidido pelo domínio a cada movimento e a cada edição do alvo (CA-08.3). */
export async function gravarAtingidaEm(
  db: Kysely<DB>,
  dados: Visao & { id: string; atingidaEm: string | null },
): Promise<void> {
  await sql`
    update app.meta set atingida_em = ${dados.atingidaEm}::date
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(
    db,
  );
}

/** O autor do movimento com o id (nulo se não existe ou se a RLS o esconde): decide o reenvio (RT-03). */
export async function autorDoMovimento(db: Kysely<DB>, id: string): Promise<string | null> {
  const r = await sql<{ autor_id: string }>`select autor_id from app.movimento_meta where id = ${id}`.execute(db);
  return r.rows[0]?.autor_id ?? null;
}

/** Grava o movimento se o id está livre; `false` se já existe (de quem a RLS esconde). Imutável depois. */
export async function inserirMovimentoSeLivre(
  db: Kysely<DB>,
  dados: Visao & {
    id: string;
    metaId: string;
    tipo: TipoMovimento;
    valorCentavos: number;
    data: string;
    local: string;
    agora: Date;
  },
): Promise<boolean> {
  const r = await sql`
    insert into app.movimento_meta (id, lar_id, meta_id, tipo, valor_centavos, data, local, autor_id, criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.metaId}, ${dados.tipo}, ${dados.valorCentavos}, ${dados.data}::date,
            ${dados.local}, ${dados.membroId}, ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

/**
 * Grava o movimento de conta privado do autor, ligado ao movimento de meta (RN-09): o aporte debita (saída) e a
 * retirada credita (entrada).
 */
export async function inserirMovimentoDeConta(
  db: Kysely<DB>,
  dados: Visao & {
    contaId: string;
    movimentoMetaId: string;
    tipo: TipoMovimento;
    valorCentavos: number;
    data: string;
    agora: Date;
  },
): Promise<void> {
  const sentido = dados.tipo === 'aporte' ? 'saida' : 'entrada';
  await sql`
    insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data,
                                     movimento_meta_id, criado_em)
    values (${dados.larId}, ${dados.membroId}, ${dados.contaId}, ${dados.tipo}, ${sentido}, ${dados.valorCentavos},
            ${dados.data}::date, ${dados.movimentoMetaId}, ${dados.agora.toISOString()}::timestamptz)`.execute(db);
}

export interface MovimentoDaMeta {
  id: string;
  tipo: TipoMovimento;
  valor_centavos: number;
  data: string;
  local: string;
  autor_nome: string;
  autor_sou_eu: boolean;
  /** Só nas linhas do próprio autor (RN-08, CA-08.5). */
  conta_nome: string | null;
}

/**
 * Aportes e retiradas da meta, do mais recente ao mais antigo. A conta só vem nas linhas do próprio autor: o
 * movimento de conta é do dono (RLS) e o filtro por autor é a segunda barreira (G-10).
 */
export async function movimentosDaMeta(
  db: Kysely<DB>,
  dados: { metaId: string; membroId: string },
): Promise<MovimentoDaMeta[]> {
  const r = await sql<Omit<MovimentoDaMeta, 'valor_centavos'> & { valor: string }>`
    select mm.id, mm.tipo, mm.valor_centavos::text as valor, mm.data::text as data, mm.local,
           a.nome as autor_nome, mm.autor_id = ${dados.membroId} as autor_sou_eu,
           case when mm.autor_id = ${dados.membroId} then c.nome end as conta_nome
      from app.movimento_meta mm
      join app.membro a on a.id = mm.autor_id
      left join app.movimento_conta mc on mc.movimento_meta_id = mm.id and mc.dono_id = ${dados.membroId}
      left join app.conta c on c.id = mc.conta_id and c.dono_id = ${dados.membroId}
     where mm.meta_id = ${dados.metaId}
     order by mm.data desc, mm.criado_em desc, mm.id desc`.execute(db);
  return r.rows.map(({ valor, ...m }) => ({ ...m, valor_centavos: Number(valor) }));
}

/** Locais já usados nas metas visíveis, do uso mais recente ao mais antigo, zerados inclusive (CA-09.5). */
export async function locaisUsados(db: Kysely<DB>, visao: Visao): Promise<string[]> {
  const r = await sql<{ local: string }>`
    select mm.local
      from app.movimento_meta mm
      join app.meta m on m.id = mm.meta_id
     where m.lar_id = ${visao.larId} and (m.escopo = 'conjunto' or m.dono_id = ${visao.membroId})
     group by mm.local
     order by max(mm.data) desc, mm.local`.execute(db);
  return r.rows.map((l) => l.local);
}

/** Σ aportes − Σ retiradas FEITOS PELO MEMBRO no mês, em todas as metas visíveis (RN-16c). Informativo; pode ser negativo. */
export async function guardadoNoMes(db: Kysely<DB>, dados: Visao & { mes: string }): Promise<number> {
  const r = await sql<{ total: string }>`
    select coalesce(sum(case mm.tipo when 'aporte' then mm.valor_centavos else -mm.valor_centavos end), 0)::text as total
      from app.movimento_meta mm
      join app.meta m on m.id = mm.meta_id
     where mm.autor_id = ${dados.membroId} and m.lar_id = ${dados.larId}
       and (m.escopo = 'conjunto' or m.dono_id = ${dados.membroId})
       and mm.data >= ${dados.mes}::date and mm.data < ${dados.mes}::date + interval '1 month'`.execute(db);
  return Number(r.rows[0]?.total ?? 0);
}
