import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Categorias do lar (SDD 3.5; RN-17): as iniciais (etapa 6), a leitura que decide se o lar é descartável
 * (CA-23.9) e o cadastro (etapa 7). O cadastro filtra por lar e por "conjunta ou do próprio membro" além da
 * RLS (CA-T1.4: as duas camadas); a individual do outro membro nunca é enxergada.
 */

export interface CategoriaParaCriar {
  tipo: 'despesa' | 'receita';
  nome: string;
  variavel: boolean | null;
}

/**
 * Cria as categorias indicadas no lar, conjuntas (sem dono) ou individuais do membro. A unicidade
 * (`categoria_unica`) resolve a corrida: a criação concorrente não duplica (CA-17.4).
 */
export async function inserirCategorias(
  db: Kysely<DB>,
  dados: { larId: string; donoId: string | null; categorias: readonly CategoriaParaCriar[] },
): Promise<void> {
  if (dados.categorias.length === 0) return;
  await db
    .insertInto('categoria')
    .values(
      dados.categorias.map((c) => ({
        lar_id: dados.larId,
        tipo: c.tipo,
        escopo: dados.donoId ? ('individual' as const) : ('conjunto' as const),
        dono_id: dados.donoId,
        nome: c.nome,
        variavel: c.variavel,
      })),
    )
    .onConflict((oc) => oc.constraint('categoria_unica').doNothing())
    .execute();
}

export interface CategoriaDoLar {
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
  nome: string;
  variavel: boolean | null;
  arquivada: boolean;
}

/** As categorias que o vínculo atual enxerga no próprio lar (conjuntas e as individuais dele). */
export async function listarDoLarAtual(db: Kysely<DB>): Promise<CategoriaDoLar[]> {
  const consulta = sql<CategoriaDoLar>`
    select tipo, escopo, nome, variavel, arquivada from app.categoria where lar_id = app.lar_atual()`;
  return (await consulta.execute(db)).rows;
}

/** Descarte do lar só com as iniciais (CA-23.9): apaga as categorias que o vínculo atual enxerga no lar. */
export async function apagarDoLarAtual(db: Kysely<DB>): Promise<void> {
  await sql`delete from app.categoria where lar_id = app.lar_atual()`.execute(db);
}

export interface CategoriaVisivel {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
  variavel: boolean | null;
  arquivada: boolean;
}

export interface Visao {
  larId: string;
  membroId: string;
}

/** A categoria que o membro enxerga: conjunta do lar ou individual dele (nula nos demais casos). */
export async function buscarCategoriaVisivel(
  db: Kysely<DB>,
  dados: Visao & { id: string },
): Promise<CategoriaVisivel | null> {
  const r = await sql<CategoriaVisivel>`
    select id, nome, tipo, escopo, variavel, arquivada from app.categoria
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(
    db,
  );
  return r.rows[0] ?? null;
}

/**
 * Cria a categoria se o id está livre (`false` se já existe, do membro em corrida ou de outro). A unicidade de
 * nome (`categoria_unica`) continua levantando 23505, que a API traduz em `nome_repetido`.
 */
export async function inserirCategoriaSeLivre(
  db: Kysely<DB>,
  dados: Visao & {
    id: string;
    tipo: string;
    escopo: string;
    nome: string;
    variavel: boolean | null;
    agora: Date;
  },
): Promise<boolean> {
  const donoId = dados.escopo === 'individual' ? dados.membroId : null;
  const r = await sql`
    insert into app.categoria (id, lar_id, tipo, escopo, dono_id, nome, variavel, criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.tipo}, ${dados.escopo}, ${donoId}, ${dados.nome}, ${dados.variavel},
            ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

export async function atualizarCategoria(
  db: Kysely<DB>,
  dados: Visao & { id: string; nome: string; variavel: boolean | null },
): Promise<void> {
  await sql`
    update app.categoria set nome = ${dados.nome}, variavel = ${dados.variavel}
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(
    db,
  );
}

export async function arquivarCategoria(db: Kysely<DB>, dados: Visao & { id: string }): Promise<number> {
  const r = await sql`
    update app.categoria set arquivada = true
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(
    db,
  );
  return Number(r.numAffectedRows ?? 0);
}

/** Exclui. Com vínculo (lançamento, orçamento, fixa; etapas 8 a 10) o Postgres recusa com 23503. */
export async function excluirCategoria(db: Kysely<DB>, dados: Visao & { id: string }): Promise<number> {
  const r = await sql`
    delete from app.categoria
     where id = ${dados.id} and lar_id = ${dados.larId} and (escopo = 'conjunto' or dono_id = ${dados.membroId})`.execute(
    db,
  );
  return Number(r.numAffectedRows ?? 0);
}

export interface CategoriaListada extends CategoriaVisivel {
  pode_excluir: boolean;
}

/**
 * Conjuntas do lar e individuais do membro; arquivadas entram. `pode_excluir`: sem lançamento (etapa 8), despesa
 * fixa (etapa 9) nem orçamento (etapa 10) ligados. Sob a RLS, o lançamento e o orçamento que usam uma categoria
 * visível também são visíveis (conjunta do lar, ou individual do próprio dono); a fixa é do lar e usa só conjuntas.
 */
export async function listarCategoriasVisiveis(db: Kysely<DB>, visao: Visao): Promise<CategoriaListada[]> {
  const r = await sql<CategoriaListada>`
    select c.id, c.nome, c.tipo, c.escopo, c.variavel, c.arquivada,
           (not exists (select 1 from app.lancamento l where l.categoria_id = c.id)
            and not exists (select 1 from app.despesa_fixa f where f.categoria_id = c.id)
            and not exists (select 1 from app.orcamento o where o.categoria_id = c.id)) as pode_excluir
      from app.categoria c
     where c.lar_id = ${visao.larId} and (c.escopo = 'conjunto' or c.dono_id = ${visao.membroId})
     order by c.tipo, c.escopo, c.nome, c.id`.execute(db);
  return r.rows;
}
