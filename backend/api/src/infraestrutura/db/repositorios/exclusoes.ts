import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Pedidos de exclusão de conta (SDD 3.3 `exclusao_conta`; RN-26). Tabela de acesso, sem RLS por linha (D-03): o
 * usuário vem do token consumido ou da sessão, nunca do cliente. A app só insere e grava a confirmação; a purga
 * (owner, `purgar.ts`) grava `purgada_em`.
 */

/** Abre o pedido do usuário, se ainda não houver um em aberto (o índice único parcial decide na corrida). */
export async function abrirPedido(db: Kysely<DB>, usuarioId: string, agora: Date): Promise<void> {
  await sql`
    insert into app.exclusao_conta (usuario_id, solicitada_em)
    values (${usuarioId}, ${agora.toISOString()}::timestamptz)
    on conflict (usuario_id) where cancelada_em is null and purgada_em is null do nothing`.execute(db);
}

/**
 * Confirma o pedido em aberto e agenda a purga para a confirmação + 30 dias (CA-26.2). Devolve o instante da purga,
 * ou `null` se não havia pedido em aberto e ainda não confirmado.
 */
export async function confirmarPedido(db: Kysely<DB>, usuarioId: string, agora: Date): Promise<Date | null> {
  const r = await sql<{ purgar_em: Date }>`
    update app.exclusao_conta
       set confirmada_em = ${agora.toISOString()}::timestamptz,
           purgar_em = ${agora.toISOString()}::timestamptz + interval '30 days'
     where usuario_id = ${usuarioId} and cancelada_em is null and purgada_em is null and confirmada_em is null
    returning purgar_em`.execute(db);
  return r.rows[0]?.purgar_em ?? null;
}

/** `true` se o usuário tem exclusão confirmada e ainda não purgada (CA-26.6: o login é recusado). */
export async function estaEmExclusao(db: Kysely<DB>, usuarioId: string): Promise<boolean> {
  const r = await sql`
    select 1 from app.exclusao_conta
     where usuario_id = ${usuarioId} and confirmada_em is not null and cancelada_em is null and purgada_em is null`.execute(
    db,
  );
  return r.rows.length > 0;
}

/** O convidado ativo do lar atual (nome e e-mail), para o aviso de encerramento (CA-26.7). Nulo sem convidado. */
export async function convidadoAtivoDoLarAtual(db: Kysely<DB>): Promise<{ nome: string; email: string } | null> {
  const r = await sql<{ nome: string; email: string }>`
    select m.nome, u.email::text as email
      from app.membro m join app.usuario u on u.id = m.usuario_id
     where m.lar_id = app.lar_atual() and m.papel = 'membro' and m.saiu_em is null`.execute(db);
  return r.rows[0] ?? null;
}

/**
 * Instante da purga do lar atual, quando o TITULAR ativo dele confirmou a exclusão (D1, CA-26.7): o lar inteiro será
 * apagado nesse dia. Lê `membro` pela RLS do lar; nulo se não houver encerramento.
 */
export async function encerramentoDoLarAtual(db: Kysely<DB>): Promise<Date | null> {
  const r = await sql<{ purgar_em: Date }>`
    select e.purgar_em
      from app.membro m
      join app.exclusao_conta e on e.usuario_id = m.usuario_id
     where m.lar_id = app.lar_atual() and m.papel = 'titular' and m.saiu_em is null
       and e.confirmada_em is not null and e.cancelada_em is null and e.purgada_em is null`.execute(db);
  return r.rows[0]?.purgar_em ?? null;
}
