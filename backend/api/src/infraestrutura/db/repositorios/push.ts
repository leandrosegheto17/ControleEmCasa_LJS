import { MAX_ASSINATURAS_PUSH, PREFERENCIAS_PADRAO, type Preferencias } from '@controle/contrato';
import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Inscrições de push, preferências e avisos já dados (SDD 3.6; RN-27; ADR-014). As leituras e escritas do usuário
 * passam pela RLS da própria sessão; as do cron, pelo contexto `app.sistema = 'cron'` (`app.em_cron()`), sempre com o
 * lar já fixado por `enxergarLarNoSistema` e filtrando por ele.
 */

// ---------------------------------------------------------------------------------------------------
// Rotas do usuário

/**
 * Inscreve o aparelho no vínculo atual, idempotente pelo endpoint (CA-T3.4). Quem tem o endpoint tem o navegador:
 * a inscrição do mesmo endpoint feita por outro usuário (aparelho compartilhado) ou noutro vínculo é removida antes,
 * e a deste vínculo com outras chaves é trocada. Depois, mantém no máximo `MAX_ASSINATURAS_PUSH` por usuário (sai a de
 * uso mais antigo, nunca a que acabou de entrar).
 */
export async function inscrever(
  db: Kysely<DB>,
  dados: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  // Só esta rota grava o GUC do endpoint, local à transação (G-02): libera ver e remover a linha deste endpoint.
  await sql`select set_config('app.push_endpoint', ${dados.endpoint}, true)`.execute(db);
  await sql`
    delete from app.push_subscription
     where endpoint = ${dados.endpoint}
       and not (usuario_id = app.usuario_atual() and membro_id = app.membro_atual() and lar_id = app.lar_atual()
                and p256dh = ${dados.p256dh} and auth = ${dados.auth})`.execute(db);
  await sql`
    insert into app.push_subscription (endpoint, p256dh, auth)
    values (${dados.endpoint}, ${dados.p256dh}, ${dados.auth})
    on conflict (endpoint) do nothing`.execute(db);
  await sql`
    delete from app.push_subscription
     where id in (
       select id from app.push_subscription
        where usuario_id = app.usuario_atual()
        order by (endpoint = ${dados.endpoint}) desc, coalesce(ultimo_envio_em, criado_em) desc, criado_em desc, id
        offset ${MAX_ASSINATURAS_PUSH})`.execute(db);
}

/** Remove a inscrição do endpoint, se for do usuário da sessão (TM-PUSH-04). Idempotente. */
export async function removerInscricao(db: Kysely<DB>, endpoint: string): Promise<void> {
  await sql`
    delete from app.push_subscription where endpoint = ${endpoint} and usuario_id = app.usuario_atual()`.execute(db);
}

/** Remove TODAS as inscrições do usuário da sessão, de qualquer vínculo (CA-27.6: sair de todos e exclusão). */
export async function removerInscricoesDoUsuario(db: Kysely<DB>): Promise<number> {
  const r = await sql`delete from app.push_subscription where usuario_id = app.usuario_atual()`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}

interface LinhaPreferencias {
  fixas: boolean;
  lembrete_diario: boolean;
  lembrete_hora: number;
  metas: boolean;
}

/** Preferências do membro atual; sem linha, os padrões (RN-27). */
export async function lerPreferencias(db: Kysely<DB>): Promise<Preferencias> {
  const r = await sql<LinhaPreferencias>`
    select fixas, lembrete_diario, lembrete_hora::int as lembrete_hora, metas
      from app.preferencia_notificacao
     where membro_id = app.membro_atual() and lar_id = app.lar_atual()`.execute(db);
  return r.rows[0] ?? { ...PREFERENCIAS_PADRAO };
}

export async function salvarPreferencias(db: Kysely<DB>, p: Preferencias, agora: Date): Promise<void> {
  await sql`
    insert into app.preferencia_notificacao (fixas, lembrete_diario, lembrete_hora, metas, atualizado_em)
    values (${p.fixas}, ${p.lembrete_diario}, ${p.lembrete_hora}, ${p.metas}, ${agora.toISOString()}::timestamptz)
    on conflict (membro_id) do update
       set fixas = excluded.fixas, lembrete_diario = excluded.lembrete_diario, lembrete_hora = excluded.lembrete_hora,
           metas = excluded.metas, atualizado_em = excluded.atualizado_em`.execute(db);
}

// ---------------------------------------------------------------------------------------------------
// Cron (contexto de sistema, lar a lar)

/** Lares com ao menos um aparelho inscrito, em páginas por id (lotes do cron; TM-PUSH-06). */
export async function laresComInscricao(
  db: Kysely<DB>,
  dados: { depoisDe: string | null; limite: number },
): Promise<string[]> {
  const r = await sql<{ lar_id: string }>`
    select distinct lar_id::text as lar_id from app.push_subscription
     where ${dados.depoisDe}::uuid is null or lar_id > ${dados.depoisDe}::uuid
     order by lar_id limit ${dados.limite}`.execute(db);
  return r.rows.map((l) => l.lar_id);
}

export interface Destinatario {
  membroId: string;
  preferencias: Preferencias;
}

/** Membros ATIVOS do lar fixado, com as preferências (padrão quando não há linha). */
export async function destinatariosDoLar(db: Kysely<DB>, larId: string): Promise<Destinatario[]> {
  const r = await sql<LinhaPreferencias & { membro_id: string; tem: boolean }>`
    select m.id::text as membro_id, p.membro_id is not null as tem,
           coalesce(p.fixas, true) as fixas, coalesce(p.lembrete_diario, false) as lembrete_diario,
           coalesce(p.lembrete_hora, ${PREFERENCIAS_PADRAO.lembrete_hora})::int as lembrete_hora,
           coalesce(p.metas, true) as metas
      from app.membro m
      left join app.preferencia_notificacao p on p.membro_id = m.id and p.lar_id = m.lar_id
     where m.lar_id = ${larId} and m.lar_id = app.lar_atual() and m.saiu_em is null
     order by m.id`.execute(db);
  return r.rows.map((l) => ({
    membroId: l.membro_id,
    preferencias: {
      fixas: l.fixas,
      lembrete_diario: l.lembrete_diario,
      lembrete_hora: l.lembrete_hora,
      metas: l.metas,
    },
  }));
}

export interface Inscricao {
  id: string;
  membroId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Aparelhos dos membros indicados, no lar fixado. */
export async function inscricoesDosMembros(db: Kysely<DB>, larId: string, membros: string[]): Promise<Inscricao[]> {
  if (membros.length === 0) return [];
  const r = await sql<{ id: string; membro_id: string; endpoint: string; p256dh: string; auth: string }>`
    select id::text as id, membro_id::text as membro_id, endpoint, p256dh, auth
      from app.push_subscription
     where lar_id = ${larId} and membro_id = any(${membros}::uuid[])
     order by membro_id, id`.execute(db);
  return r.rows.map((l) => ({ id: l.id, membroId: l.membro_id, endpoint: l.endpoint, p256dh: l.p256dh, auth: l.auth }));
}

export type TipoAviso = 'fixa_vencendo' | 'fixa_atrasada' | 'lembrete_diario' | 'meta_atingida';

/**
 * Marca o aviso (membro, tipo, referência, dia) e diz se é a PRIMEIRA vez (CA-27.4). Só o aviso marcado agora sai:
 * duas execuções (ou dois aportes no mesmo dia) não repetem a notificação.
 */
export async function marcarAviso(
  db: Kysely<DB>,
  dados: { membroId: string; larId: string; tipo: TipoAviso; referencia: string; dia: string },
): Promise<boolean> {
  const r = await sql`
    insert into app.aviso_push (membro_id, lar_id, tipo, referencia, dia)
    values (${dados.membroId}, ${dados.larId}, ${dados.tipo}, ${dados.referencia}, ${dados.dia}::date)
    on conflict do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

/** Ocorrências NÃO pagas do lar fixado com vencimento no dia (fixas que ainda geram). */
export async function haOcorrenciaPendenteEm(db: Kysely<DB>, larId: string, vencimento: string): Promise<boolean> {
  const r = await sql<{ ha: boolean }>`
    select exists (
      select 1 from app.ocorrencia_fixa o
       where o.lar_id = ${larId} and o.lar_id = app.lar_atual()
         and o.vencimento = ${vencimento}::date and o.lancamento_id is null) as ha`.execute(db);
  return r.rows[0]?.ha ?? false;
}

/**
 * O membro lançou algo (despesa ou receita, conjunta ou individual) criado no intervalo? Exige o membro fixado no GUC
 * (a individual só é visível ao dono), e o filtro por dono não deixa um membro "contar" pelo outro.
 */
export async function lancouEntre(
  db: Kysely<DB>,
  dados: { larId: string; membroId: string; desde: Date; ate: Date },
): Promise<boolean> {
  const r = await sql<{ ha: boolean }>`
    select exists (
      select 1 from app.lancamento l
       where l.lar_id = ${dados.larId} and l.dono_id = ${dados.membroId} and l.dono_id = app.membro_atual()
         and l.criado_em >= ${dados.desde.toISOString()}::timestamptz
         and l.criado_em < ${dados.ate.toISOString()}::timestamptz) as ha`.execute(db);
  return r.rows[0]?.ha ?? false;
}

/** Resultado de um envio: `ok` zera as falhas; `expirada` remove; `falha` soma 1 e remove na 5ª (SDD 3.6). */
export async function registrarResultado(
  db: Kysely<DB>,
  dados: { id: string; resultado: 'ok' | 'expirada' | 'falha'; agora: Date },
): Promise<void> {
  if (dados.resultado === 'ok') {
    await sql`
      update app.push_subscription set ultimo_envio_em = ${dados.agora.toISOString()}::timestamptz, falhas = 0
       where id = ${dados.id}`.execute(db);
  } else if (dados.resultado === 'expirada') {
    await sql`delete from app.push_subscription where id = ${dados.id}`.execute(db);
  } else {
    await sql`delete from app.push_subscription where id = ${dados.id} and falhas >= 4`.execute(db);
    await sql`update app.push_subscription set falhas = falhas + 1 where id = ${dados.id}`.execute(db);
  }
}

/** Poda dos avisos antigos (o registro só importa no próprio dia). */
export async function podarAvisos(db: Kysely<DB>, antesDe: string): Promise<number> {
  const r = await sql`delete from app.aviso_push where dia < ${antesDe}::date`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}
