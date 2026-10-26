import { env } from 'cloudflare:workers';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { CRON_LIMPEZA, CRON_PUSH, criarScheduled, executarAgendada, tarefaDoCron } from './entrada/agendadas';
import worker from './entrada/worker';
import type { Bindings } from './env';
import { bancoDisponivel } from './testes-suporte';
import { comoOwner } from './testes-suporte-acesso';
import { linhasComoOwner } from './testes-suporte-lar';
import wranglerBruto from '../../../wrangler.jsonc?raw';

/**
 * Crons do Worker (SDD 8.6 e 11.1; ADR-013, ADR-014): `0 * * * *` (push) e `30 6 * * *` (limpeza diária).
 * A limpeza roda de verdade contra o banco compartilhado, com o relógio em 2020: só os registros deste teste (de 2019)
 * estão vencidos nessa data; os dos outros arquivos (de 2026) nunca são tocados.
 */

const AGORA_LIMPEZA = new Date('2020-01-01T09:30:00.000Z');

describe('ligação dos crons', () => {
  it('o wrangler.jsonc declara exatamente os dois crons que o Worker trata', () => {
    expect(wranglerBruto).toMatch(/"crons":\s*\[\s*"0 \* \* \* \*",\s*"30 6 \* \* \*"\s*\]/);
    expect(tarefaDoCron(CRON_PUSH)).toBe('push');
    expect(tarefaDoCron(CRON_LIMPEZA)).toBe('limpeza');
    expect(tarefaDoCron('*/5 * * * *')).toBeNull();
  });

  it('o Worker exporta fetch e scheduled', () => {
    expect(typeof worker.fetch).toBe('function');
    expect(typeof worker.scheduled).toBe('function');
  });

  it('cron desconhecido não abre conexão nem falha', async () => {
    await expect(
      executarAgendada('*/5 * * * *', {
        ...(env as unknown as Bindings),
        HYPERDRIVE: { connectionString: 'postgres://x:x@127.0.0.1:1/x' } as Hyperdrive,
      }),
    ).resolves.toBeUndefined();
  });
});

interface Fixtura {
  usuario: string;
  convVencido: string;
  convValido: string;
  membro: string;
  lar: string;
}

async function montar(): Promise<Fixtura> {
  return comoOwner(async (db) => {
    const u = await sql<{ id: string }>`
      insert into app.usuario (email, nome, senha_hash, email_confirmado_em)
      values (${`limpeza.${crypto.randomUUID()}@exemplo.com`}, 'Limpeza', 'x', now()) returning id`.execute(db);
    const usuario = u.rows[0]!.id;
    const lares: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const l = await sql<{ id: string }>`
        insert into app.lar (nome, criado_por, criado_em) values ('Casa', ${usuario}, '2019-01-01') returning id`.execute(
        db,
      );
      lares.push(l.rows[0]!.id);
    }
    const m = await sql<{ id: string }>`
      insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em)
      values (${lares[0]}, ${usuario}, 'Limpeza', 'titular', '2019-01-01') returning id`.execute(db);
    const membro = m.rows[0]!.id;
    const m2 = await sql<{ id: string }>`
      insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em, saiu_em)
      values (${lares[1]}, ${usuario}, 'Ex', 'titular', '2019-01-01', '2019-01-02') returning id`.execute(db);
    const convite = async (lar: string, membroId: string, criado: string) => {
      const r = await sql<{ id: string }>`
        insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
        values (${lar}, ${membroId}, 'convidado@exemplo.com', ${crypto.getRandomValues(new Uint8Array(32))}, 'Casa', 'L',
                ${criado}::timestamptz, ${criado}::timestamptz + interval '7 days')
        returning id`.execute(db);
      return r.rows[0]!.id;
    };
    // Vencido em 30/12/2019; válido até 05/01/2020.
    const convVencido = await convite(lares[0]!, membro, '2019-12-23T00:00:00Z');
    const convValido = await convite(lares[1]!, m2.rows[0]!.id, '2019-12-29T00:00:00Z');
    const h = () => crypto.getRandomValues(new Uint8Array(32));
    // Sessões: vencida por inatividade, vencida pelas 12 h, e viva.
    await sql`
      insert into app.sessao (token_hash, usuario_id, criada_em, ultimo_uso_em, expira_absoluta_em) values
        (${h()}, ${usuario}, '2019-12-31T10:00:00Z', '2019-12-31T10:00:00Z', '2019-12-31T22:00:00Z'),
        (${h()}, ${usuario}, '2019-12-31T21:30:00Z', '2020-01-01T09:28:00Z', '2020-01-01T09:30:00Z'),
        (${h()}, ${usuario}, '2020-01-01T09:00:00Z', '2020-01-01T09:25:00Z', '2020-01-01T21:00:00Z')`.execute(db);
    // Tentativas: de 25 h atrás (sai) e de 23 h atrás (fica).
    await sql`
      insert into app.tentativa_login (email_hash, sucesso, momento) values
        (${h()}, false, '2019-12-31T08:30:00Z'), (${h()}, false, '2019-12-31T10:30:00Z')`.execute(db);
    // Tokens: vencido há mais de 1 dia (sai) e há menos (fica).
    await sql`
      insert into app.token_email (usuario_id, finalidade, token_hash, criado_em, expira_em) values
        (${usuario}, 'exclusao', ${h()}, '2019-12-30T08:00:00Z', '2019-12-30T08:30:00Z'),
        (${usuario}, 'confirmacao', ${h()}, '2019-12-31T11:00:00Z', '2019-12-31T11:30:00Z')`.execute(db);
    // Avisos de push: de antes de ontem (sai) e de ontem (fica).
    await sql`
      insert into app.aviso_push (membro_id, lar_id, tipo, referencia, dia) values
        (${membro}, ${lares[0]}, 'lembrete_diario', '', '2019-12-30'),
        (${membro}, ${lares[0]}, 'lembrete_diario', '', '2019-12-31')`.execute(db);
    return { usuario, convVencido, convValido, membro, lar: lares[0]! };
  });
}

async function estado(f: Fixtura) {
  const um = async <T>(q: ReturnType<typeof sql<T>>) => (await linhasComoOwner(q))[0]!;
  return {
    convVencido: (await um(sql<{ s: string }>`select situacao as s from app.convite where id = ${f.convVencido}`)).s,
    convValido: (await um(sql<{ s: string }>`select situacao as s from app.convite where id = ${f.convValido}`)).s,
    sessoes: (await um(sql<{ n: number }>`select count(*)::int as n from app.sessao where usuario_id = ${f.usuario}`))
      .n,
    tentativas: (
      await um(
        sql<{ n: number }>`select count(*)::int as n from app.tentativa_login
                             where momento in ('2019-12-31T08:30:00Z', '2019-12-31T10:30:00Z')`,
      )
    ).n,
    tokens: (
      await um(sql<{ n: number }>`select count(*)::int as n from app.token_email where usuario_id = ${f.usuario}`)
    ).n,
    avisos: (await um(sql<{ n: number }>`select count(*)::int as n from app.aviso_push where membro_id = ${f.membro}`))
      .n,
  };
}

describe.skipIf(!bancoDisponivel)('limpeza diária (SDD 11.1; G-50; ADR-013)', () => {
  it('pelo handler scheduled do cron 30 6 * * *: expira convites vencidos e poda o que venceu, nada além', async () => {
    const f = await montar();
    expect(await estado(f)).toEqual({
      convVencido: 'pendente',
      convValido: 'pendente',
      sessoes: 3,
      tentativas: 2,
      tokens: 2,
      avisos: 2,
    });
    const pendentes: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void pendentes.push(p),
      passThroughOnException: () => undefined,
      props: {},
    } as unknown as ExecutionContext;
    const scheduled = criarScheduled({ relogio: () => new Date(AGORA_LIMPEZA) });
    await scheduled(
      { cron: CRON_LIMPEZA, scheduledTime: AGORA_LIMPEZA.getTime(), noRetry: () => undefined } as ScheduledController,
      env as unknown as Bindings,
      ctx,
    );
    expect(pendentes).toHaveLength(1);
    await Promise.all(pendentes);
    expect(await estado(f)).toEqual({
      convVencido: 'expirado',
      convValido: 'pendente',
      sessoes: 1,
      tentativas: 1,
      tokens: 1,
      avisos: 1,
    });
    // Rodar de novo não muda nada.
    await executarAgendada(CRON_LIMPEZA, env as unknown as Bindings, { relogio: () => new Date(AGORA_LIMPEZA) });
    expect((await estado(f)).sessoes).toBe(1);
  });
});
