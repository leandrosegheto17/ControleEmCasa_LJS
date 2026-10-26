import { sql, type Kysely, type Transaction } from 'kysely';
import type { Sessao, Vinculo } from '../../env';
import type { DB } from './tipos';

/**
 * Abre a transação da requisição e grava a identidade como GUC LOCAL (G-02, ADR 005):
 * `set_config(..., true)` some no COMMIT e no ROLLBACK, então a conexão volta ao pool do Hyperdrive sem identidade.
 * É o PRIMEIRO comando da transação. GUC vazio ('') nega o acesso nas políticas (`app.usuario_atual()` vira NULL).
 * Em seguida o vínculo (lar, membro e papel) é DERIVADO de `app.membro` no banco (SDD 5.3; G-03), nunca do
 * chamador. A função recebe o vínculo lido.
 * Proibido (G-02): GUC global (is_local falso), SET fora de LOCAL e consulta de negócio fora desta transação;
 * a varredura de código dos testes recusa esses padrões.
 */
export async function emTransacaoComo<T>(
  db: Kysely<DB>,
  sessao: Sessao,
  fn: (trx: Transaction<DB>, vinculo: Vinculo | null) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => fn(trx, await assumirIdentidade(trx, sessao)));
}

/**
 * Grava a identidade como GUC LOCAL na transação já aberta e deriva o vínculo (o mesmo que `emTransacaoComo` faz ao
 * abrir). Fora de `emTransacaoComo`, só a confirmação da exclusão de conta usa isto (RN-26): o usuário vem do token
 * consumido na MESMA transação (tabela de acesso, sem RLS), e o resto da confirmação precisa do vínculo dele.
 */
export async function assumirIdentidade(trx: Transaction<DB>, sessao: Sessao): Promise<Vinculo | null> {
  await sql`select set_config('app.usuario_id', ${sessao.usuarioId}, true),
                   set_config('app.email', ${sessao.email}, true)`.execute(trx);
  return derivarVinculo(trx, sessao.usuarioId);
}

/**
 * Lê o vínculo ativo do usuário e grava `app.lar_id`, `app.membro_id` e `app.papel` NA MESMA instrução, a
 * partir da mesma linha de `membro` (SDD 5.3): o lar fica validado contra o vínculo por construção (R3).
 * Sem vínculo, os três ficam vazios (a instrução sempre devolve uma linha). Usado ao abrir a transação e de
 * novo quando o vínculo muda dentro dela (criar o lar, aceitar convite).
 * A leitura de `membro` passa pela RLS (`usuario_id = app.usuario_atual()`), já gravado no comando anterior.
 */
export async function derivarVinculo(trx: Transaction<DB>, usuarioId: string): Promise<Vinculo | null> {
  const r = await sql<{ lar: string; membro: string; papel: string }>`
    with ativo as (
      select m.lar_id::text as lar, m.id::text as membro, m.papel
        from app.membro m
       where m.usuario_id = ${usuarioId} and m.saiu_em is null
    ), linha as (
      select coalesce(a.lar, '') as lar, coalesce(a.membro, '') as membro, coalesce(a.papel, '') as papel
        from (select 1) as um left join ativo a on true
    )
    select set_config('app.lar_id', linha.lar, true) as lar,
           set_config('app.membro_id', linha.membro, true) as membro,
           set_config('app.papel', linha.papel, true) as papel
      from linha`.execute(trx);
  const v = r.rows[0];
  if (!v || !v.lar || !v.membro || (v.papel !== 'titular' && v.papel !== 'membro')) return null;
  return { larId: v.lar, membroId: v.membro, papel: v.papel };
}

/**
 * Transação de SISTEMA (SDD 5.1 "o webhook pula os passos 4, 6, 7, 8 e 9"; SDD 5.3): o primeiro comando grava
 * `app.sistema` LOCAL à transação, sem usuário, lar nem membro. Só o webhook, o cron e a purga usam isto; nenhuma
 * rota de usuário o chama (a varredura dos testes confere).
 */
export async function emTransacaoDeSistema<T>(
  db: Kysely<DB>,
  sistema: 'webhook' | 'cron' | 'purga',
  fn: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.sistema', ${sistema}, true)`.execute(trx);
    return fn(trx);
  });
}

/**
 * Dentro de uma transação de sistema, passa a enxergar um lar (THREAT-MODEL E-07: iterar por lar com `set_config`
 * local, sem role ampla). O lar vem de uma linha já lida no banco, nunca do corpo do evento.
 */
export async function enxergarLarNoSistema(trx: Transaction<DB>, larId: string): Promise<void> {
  await sql`select set_config('app.lar_id', ${larId}, true)`.execute(trx);
}

/**
 * Dentro de uma transação de sistema com o lar já fixado, passa a enxergar também o individual de UM membro (o cron
 * do lembrete diário confere se ele lançou no dia; TM-PUSH-01). O membro vem de uma linha de `membro` já lida no
 * mesmo lar, nunca de fora. Troca o membro anterior (só um por vez).
 */
export async function enxergarMembroNoSistema(trx: Transaction<DB>, membroId: string): Promise<void> {
  await sql`select set_config('app.membro_id', ${membroId}, true)`.execute(trx);
}
