import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from './app';
import type { Sessao } from './env';
import { emTransacaoComo } from './infraestrutura/db/transacao';
import { emTransacao } from './middleware/transacao';
import { bancoDisponivel, chamar, ESCRITA } from './testes-suporte';
import { USUARIO_A, USUARIO_B } from '../testes/constantes';

/**
 * Risco R2, vazamento de GUC no pool (SDD 5.3 "Teste de vazamento"; G-02 b, c, d; ADR 005):
 *  1. A e B simultâneos, 50 rodadas: cada um só vê os próprios dados;
 *  2. depois do COMMIT, na mesma conexão, o GUC está vazio;
 *  3. requisição que falha no meio (ROLLBACK) também deixa o GUC vazio;
 *  4. sem GUC (ou vazio), a tabela com RLS devolve 0 linhas, nunca todas.
 * Postgres real (banco descartável), como `controle_app` (sem BYPASSRLS), tabela `fixture_rls` com a política "dono".
 */
const sessaoDe = (u: { id: string; email: string }): Sessao => ({ usuarioId: u.id, email: u.email, larId: null });

/** A sessão do teste vem do cabeçalho X-Teste-Usuario (a sessão real chega na etapa 4). */
function appDeTeste() {
  return criarApp({
    resolverSessao: async (c) => {
      const quem = c.req.header('X-Teste-Usuario');
      if (quem === 'a') return sessaoDe(USUARIO_A);
      if (quem === 'b') return sessaoDe(USUARIO_B);
      return null;
    },
    rotas: (a) => {
      a.use('/api/_t/na-transacao/*', emTransacao);
      // lê o GUC e as linhas visíveis, com uma pausa para entrelaçar as duas requisições
      a.get('/api/_t/na-transacao/quem-sou', async (c) => {
        const trx = c.get('tx');
        await sql`select pg_sleep(0.03)`.execute(trx);
        const guc = await sql<{ v: string }>`select current_setting('app.usuario_id', true) as v`.execute(trx);
        const linhas = await sql<{ segredo: string }>`select segredo from fixture_rls order by segredo`.execute(trx);
        return c.json({ guc: guc.rows[0]?.v, segredos: linhas.rows.map((l) => l.segredo) });
      });
      // erro no meio: grava e estoura
      a.post('/api/_t/na-transacao/grava-e-falha', async (c) => {
        const trx = c.get('tx');
        await sql`insert into fixture_rls (dono_id, segredo) values (app.usuario_atual(), 'nao-pode-ficar')`.execute(
          trx,
        );
        throw new Error('falha no meio');
      });
      a.get('/api/_t/depois-do-commit', async (c) => {
        const db = c.get('db');
        const sessao = sessaoDe(USUARIO_A);
        const dentro = await emTransacaoComo(db, sessao, async (trx) => {
          const r = await sql<{ v: string }>`select current_setting('app.usuario_id', true) as v`.execute(trx);
          return r.rows[0]?.v;
        });
        // mesma conexão (pool de 1): depois do COMMIT o GUC local sumiu
        const depois = await sql<{ v: string | null; n: string }>`
          select current_setting('app.usuario_id', true) as v, (select count(*) from fixture_rls) as n`.execute(db);
        return c.json({ dentro, depois: depois.rows[0]?.v, linhasSemGuc: Number(depois.rows[0]?.n) });
      });
      a.get('/api/_t/depois-do-rollback', async (c) => {
        const db = c.get('db');
        let falhou = false;
        try {
          await emTransacaoComo(db, sessaoDe(USUARIO_B), async (trx) => {
            await sql`select 1`.execute(trx);
            throw new Error('falha de proposito');
          });
        } catch {
          falhou = true;
        }
        const depois = await sql<{ v: string | null; n: string }>`
          select current_setting('app.usuario_id', true) as v, (select count(*) from fixture_rls) as n`.execute(db);
        return c.json({ falhou, depois: depois.rows[0]?.v, linhasSemGuc: Number(depois.rows[0]?.n) });
      });
      a.get('/api/_t/guc-vazio', async (c) => {
        const db = c.get('db');
        const vazio = await db.transaction().execute(async (trx) => {
          await sql`select set_config('app.usuario_id', '', true)`.execute(trx);
          return Number((await sql<{ n: string }>`select count(*) as n from fixture_rls`.execute(trx)).rows[0]?.n);
        });
        const invalido = await db.transaction().execute(async (trx) => {
          await sql`select set_config('app.usuario_id', 'nao-e-uuid', true)`.execute(trx);
          return Number((await sql<{ n: string }>`select count(*) as n from fixture_rls`.execute(trx)).rows[0]?.n);
        });
        return c.json({ vazio, invalido });
      });
    },
  });
}

afterEach(() => vi.restoreAllMocks());

const como = (quem: 'a' | 'b') => ({ headers: { 'X-Teste-Usuario': quem } });

describe.skipIf(!bancoDisponivel)('R2: GUC por transação não vaza (Postgres real, role app)', () => {
  it('(1) A e B simultâneos, 50 rodadas: cada um só vê o seu GUC e os seus dados', async () => {
    const app = appDeTeste();
    for (let rodada = 0; rodada < 50; rodada += 1) {
      const [ra, rb] = await Promise.all([
        chamar(app, '/api/_t/na-transacao/quem-sou', como('a')),
        chamar(app, '/api/_t/na-transacao/quem-sou', como('b')),
      ]);
      expect(ra.status).toBe(200);
      expect(rb.status).toBe(200);
      expect(await ra.json()).toEqual({ guc: USUARIO_A.id, segredos: [`segredo de ${USUARIO_A.email}`] });
      expect(await rb.json()).toEqual({ guc: USUARIO_B.id, segredos: [`segredo de ${USUARIO_B.email}`] });
    }
  }, 60_000);

  it('(2) depois do COMMIT, na mesma conexão, o GUC está vazio e a tabela com RLS mostra 0 linhas', async () => {
    const r = await chamar(appDeTeste(), '/api/_t/depois-do-commit');
    expect(r.status).toBe(200);
    const corpo = (await r.json()) as { dentro: string; depois: string | null; linhasSemGuc: number };
    expect(corpo.dentro).toBe(USUARIO_A.id);
    expect(corpo.depois === '' || corpo.depois === null).toBe(true);
    expect(corpo.linhasSemGuc).toBe(0);
  });

  it('(3) transação que falha (ROLLBACK) também deixa o GUC vazio', async () => {
    const r = await chamar(appDeTeste(), '/api/_t/depois-do-rollback');
    const corpo = (await r.json()) as { falhou: boolean; depois: string | null; linhasSemGuc: number };
    expect(corpo.falhou).toBe(true);
    expect(corpo.depois === '' || corpo.depois === null).toBe(true);
    expect(corpo.linhasSemGuc).toBe(0);
  });

  it('(3b) requisição que grava e falha no meio é desfeita por inteiro', async () => {
    const app = appDeTeste();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const falha = await chamar(app, '/api/_t/na-transacao/grava-e-falha', {
      method: 'POST',
      headers: { ...ESCRITA, 'X-Teste-Usuario': 'a' },
    });
    expect(falha.status).toBe(500);
    const depois = await chamar(app, '/api/_t/na-transacao/quem-sou', como('a'));
    expect(await depois.json()).toEqual({ guc: USUARIO_A.id, segredos: [`segredo de ${USUARIO_A.email}`] });
  });

  it('(4) GUC vazio ou malformado: 0 linhas, nunca todas', async () => {
    const r = await chamar(appDeTeste(), '/api/_t/guc-vazio');
    expect(await r.json()).toEqual({ vazio: 0, invalido: 0 });
  });

  it('rota autenticada sem sessão: 401 sessao_expirada e nenhuma consulta', async () => {
    const r = await chamar(appDeTeste(), '/api/_t/na-transacao/quem-sou');
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ code: 'sessao_expirada' });
  });
});
