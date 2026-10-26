import { hojeEmSaoPaulo, somarDias } from '@controle/dominio';
import { sql, type Kysely } from 'kysely';
import { podarAvisos } from '../../infraestrutura/db/repositorios/push';
import type { DB } from '../../infraestrutura/db/tipos';
import { emTransacaoDeSistema } from '../../infraestrutura/db/transacao';
import { logar } from '../../log';

/**
 * Limpeza diária do Worker (cron `30 6 * * *`, 03:30 de Brasília; SDD 11.1; G-50; ADR-013 "limpeza curta"):
 * - convites pendentes vencidos viram `expirado` (a API já os trata como inválidos pelo `expira_em`);
 * - sessões já expiradas (inatividade de 15 min ou 12 h absolutas) são apagadas;
 * - tentativas de login com mais de 24 h (o bloqueio só olha 15 min);
 * - tokens de e-mail vencidos há mais de 1 dia;
 * - registros de aviso de push de dias anteriores a ontem.
 * A poda de 30 dias, a do webhook (12 meses) e tudo que exige DELETE fora do alcance da `app` ficam com a purga
 * (`purgar.ts`, owner; ADR-013). Cada item na sua transação, em lotes: um item que falha não impede os outros.
 * O log leva só contagens (G-46).
 */

const LOTE = 1000;
const MAX_LOTES = 20;

export interface ResumoLimpeza {
  convites_expirados: number;
  sessoes: number;
  tentativas: number;
  tokens: number;
  avisos_push: number;
  falhas: string[];
}

async function emLotes(db: Kysely<DB>, apagar: (db: Kysely<DB>) => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_LOTES; i += 1) {
    const n = await db.transaction().execute(apagar);
    total += n;
    if (n < LOTE) break;
  }
  return total;
}

const afetadas = (r: { numAffectedRows?: bigint }) => Number(r.numAffectedRows ?? 0);

export async function rodarLimpeza(deps: { db: Kysely<DB>; agora: Date }): Promise<ResumoLimpeza> {
  const agora = deps.agora.toISOString();
  const resumo: ResumoLimpeza = {
    convites_expirados: 0,
    sessoes: 0,
    tentativas: 0,
    tokens: 0,
    avisos_push: 0,
    falhas: [],
  };
  const passos: Array<[keyof Omit<ResumoLimpeza, 'falhas'>, () => Promise<number>]> = [
    [
      'convites_expirados',
      () =>
        emTransacaoDeSistema(deps.db, 'cron', async (trx) =>
          afetadas(
            await sql`
              update app.convite set situacao = 'expirado'
               where situacao = 'pendente' and expira_em <= ${agora}::timestamptz`.execute(trx),
          ),
        ),
    ],
    [
      'sessoes',
      () =>
        emLotes(deps.db, async (trx) =>
          afetadas(
            await sql`
              delete from app.sessao where id in (
                select id from app.sessao
                 where expira_absoluta_em <= ${agora}::timestamptz
                    or ultimo_uso_em <= ${agora}::timestamptz - interval '15 minutes'
                 limit ${LOTE})`.execute(trx),
          ),
        ),
    ],
    [
      'tentativas',
      () =>
        emLotes(deps.db, async (trx) =>
          afetadas(
            await sql`
              delete from app.tentativa_login where id in (
                select id from app.tentativa_login where momento < ${agora}::timestamptz - interval '24 hours'
                 limit ${LOTE})`.execute(trx),
          ),
        ),
    ],
    [
      'tokens',
      () =>
        emLotes(deps.db, async (trx) =>
          afetadas(
            await sql`
              delete from app.token_email where id in (
                select id from app.token_email where expira_em < ${agora}::timestamptz - interval '1 day'
                 limit ${LOTE})`.execute(trx),
          ),
        ),
    ],
    [
      'avisos_push',
      () => emTransacaoDeSistema(deps.db, 'cron', (trx) => podarAvisos(trx, somarDias(hojeEmSaoPaulo(deps.agora), -1))),
    ],
  ];
  for (const [campo, passo] of passos) {
    try {
      resumo[campo] = await passo();
    } catch (erro) {
      resumo.falhas.push(campo);
      logar('warn', 'limpeza_falhou', { passo: campo, erro: erro instanceof Error ? erro.name : 'desconhecido' });
    }
  }
  logar('info', 'limpeza_concluida', {
    convites_expirados: resumo.convites_expirados,
    sessoes: resumo.sessoes,
    tentativas: resumo.tentativas,
    tokens: resumo.tokens,
    avisos_push: resumo.avisos_push,
    falhas: resumo.falhas.length,
  });
  return resumo;
}
