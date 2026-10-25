import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Categorias do lar (SDD 3.5; RN-17). Nesta etapa só as iniciais e a leitura que decide se o lar é
 * descartável (CA-23.9). As rotas de cadastro são da etapa 7.
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
