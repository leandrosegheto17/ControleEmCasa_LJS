import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Membros (SDD 3.4; RN-22, RN-23). O limite de 2 e o "um lar ativo por usuário" são garantidos pelos
 * índices únicos parciais (o erro 23505 vira `lar_cheio` ou `ja_tem_lar` em `codigo-erro.ts`).
 */

export interface MembroAtivo {
  id: string;
  nome: string;
  papel: 'titular' | 'membro';
}

export async function inserirMembro(
  db: Kysely<DB>,
  dados: { larId: string; usuarioId: string; nome: string; papel: 'titular' | 'membro'; agora: Date },
): Promise<string> {
  const r = await sql<{ id: string }>`
    insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em)
    values (${dados.larId}, ${dados.usuarioId}, ${dados.nome}, ${dados.papel}, ${dados.agora.toISOString()}::timestamptz)
    returning id`.execute(db);
  const id = r.rows[0]?.id;
  if (!id) throw new Error('membro_nao_criado');
  return id;
}

/** Membros ativos do lar atual, o titular primeiro. */
export async function listarAtivosDoLar(db: Kysely<DB>): Promise<MembroAtivo[]> {
  const r = await sql<MembroAtivo>`
    select id, nome, papel from app.membro
     where lar_id = app.lar_atual() and saiu_em is null
     order by (papel = 'titular') desc, entrou_em, id`.execute(db);
  return r.rows;
}

/** O próprio vínculo atual (nome e papel), lido pela RLS. */
export async function buscarMembroAtual(db: Kysely<DB>): Promise<MembroAtivo | null> {
  const r = await sql<MembroAtivo>`
    select id, nome, papel from app.membro
     where id = app.membro_atual() and lar_id = app.lar_atual() and saiu_em is null`.execute(db);
  return r.rows[0] ?? null;
}

/** Outras linhas de membro no lar atual (ativas ou que já saíram), além da indicada. */
export async function contarOutrosNoLar(db: Kysely<DB>, membroId: string): Promise<number> {
  const r = await sql<{ n: number }>`
    select count(*)::int as n from app.membro where lar_id = app.lar_atual() and id <> ${membroId}`.execute(db);
  return r.rows[0]?.n ?? 0;
}

/**
 * Saída ou remoção (D2; CA-23.12): preenche `saiu_em` e troca o nome por "Ex-membro". Só a linha ativa do
 * lar atual, com o papel indicado. Devolve as linhas afetadas (0 = alvo inválido).
 * SPEC_DEVIATION: o SDD 3.4 diz que a saída também "zera usuario_id", mas o SDD 4 só concede UPDATE de
 * `nome` e `saiu_em` à app. Vale o grant: `usuario_id` fica e é zerado pela purga (on delete set null).
 */
export async function marcarSaida(
  db: Kysely<DB>,
  dados: { membroId: string; papel: 'titular' | 'membro'; nome: string; agora: Date },
): Promise<number> {
  const r = await sql`
    update app.membro set saiu_em = ${dados.agora.toISOString()}::timestamptz, nome = ${dados.nome}
     where id = ${dados.membroId} and lar_id = app.lar_atual() and papel = ${dados.papel} and saiu_em is null`.execute(
    db,
  );
  return Number(r.numAffectedRows ?? 0);
}
