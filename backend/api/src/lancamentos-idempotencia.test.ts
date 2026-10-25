import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { lancarDespesa, larParaLancar, novoId, parcelasNoBanco, saldoDe } from './testes-suporte-lancamentos';
import { json, linhasComoOwner, pedir } from './testes-suporte-lar';

/**
 * Idempotência pelo id do cliente nos lançamentos e no pagamento de cartão (RT-03; ADR-010; G-26; CA-T3.1 a
 * CA-T3.3, CA-T3.6). Decisão do usuário: 201 ao criar, 200 quando já existia, com `ja_existia` no corpo.
 */

const DESPESAS = '/api/lancamentos/despesas';

async function contar(tabela: 'lancamento' | 'parcela' | 'movimento_conta', coluna: string, id: string) {
  const r = await linhasComoOwner(
    sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${tabela}`)} where ${sql.ref(coluna)} = ${id}`,
  );
  return r[0]!.n;
}

describe.skipIf(!bancoDisponivel)('lançar de novo com o mesmo id (CA-T3.1, CA-T3.6)', () => {
  it('o reenvio pelo mesmo membro devolve o gravado com ja_existia true (200), sem parcela nova, mesmo com valor e categoria diferentes', async () => {
    const { app, titular, ana } = await larParaLancar('idem.lanc');
    const id = novoId();
    const corpo = {
      id,
      valor_centavos: 9_000,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    };
    const primeiro = await pedir(app, 'POST', DESPESAS, titular, corpo);
    expect(primeiro.status).toBe(201);
    const gravado = await json(primeiro);
    const reenvio = await pedir(app, 'POST', DESPESAS, titular, {
      ...corpo,
      valor_centavos: 1,
      categoria_id: ana.lazer,
      forma_id: ana.pix,
      parcelas: 1,
    });
    expect(reenvio.status).toBe(200);
    expect(await json(reenvio)).toEqual({ ...gravado, ja_existia: true });
    expect(await contar('lancamento', 'id', id)).toBe(1);
    expect(await contar('parcela', 'lancamento_id', id)).toBe(3);
  });

  it('RT-02 (exceção herdada): o reenvio com valor inválido ainda devolve o gravado (a idempotência vem antes do valor)', async () => {
    const { app, titular, ana } = await larParaLancar('idem.valor');
    const id = await lancarDespesa(app, titular, { valor_centavos: 100, categoria_id: ana.mercado, forma_id: ana.pix });
    const r = await pedir(app, 'POST', DESPESAS, titular, {
      id,
      valor_centavos: 0,
      categoria_id: novoId(),
      forma_id: novoId(),
    });
    expect(r.status).toBe(200);
    expect(await json(r)).toMatchObject({ id, ja_existia: true, valor_total_centavos: 100 });
  });

  it('a receita também: o reenvio devolve o gravado e o saldo só muda uma vez', async () => {
    const { app, titular, ana } = await larParaLancar('idem.receita');
    const antes = await saldoDe(app, titular, ana.conta);
    const corpo = {
      id: novoId(),
      valor_centavos: 700,
      categoria_id: ana.salario,
      conta_id: ana.conta,
      data: '2026-01-01',
    };
    expect((await pedir(app, 'POST', '/api/lancamentos/receitas', titular, corpo)).status).toBe(201);
    const r = await pedir(app, 'POST', '/api/lancamentos/receitas', titular, corpo);
    expect(r.status).toBe(200);
    expect(await json(r)).toMatchObject({ ja_existia: true });
    expect(await saldoDe(app, titular, ana.conta)).toBe(antes + 700);
  });
});

describe.skipIf(!bancoDisponivel)('id de outro (CA-T3.2)', () => {
  it('o id de uma conjunta do outro membro, de um individual dele ou de outro lar → registro_invalido, sem alterar o original', async () => {
    const { app, titular, membro, ana, bruno } = await larParaLancar('idem.alheio');
    const fora = await larParaLancar('idem.alheio.fora');
    const conjuntaDoBruno = await lancarDespesa(app, membro, {
      valor_centavos: 300,
      categoria_id: bruno.mercado,
      forma_id: bruno.pix,
    });
    const individualDoBruno = await lancarDespesa(app, membro, {
      valor_centavos: 400,
      categoria_id: bruno.lazer,
      forma_id: bruno.pix,
    });
    const deFora = await lancarDespesa(fora.app, fora.titular, {
      valor_centavos: 500,
      categoria_id: fora.ana.mercado,
      forma_id: fora.ana.pix,
    });
    for (const id of [conjuntaDoBruno, individualDoBruno, deFora]) {
      const antes = await parcelasNoBanco(id);
      const r = await pedir(app, 'POST', DESPESAS, titular, {
        id,
        valor_centavos: 1,
        categoria_id: ana.mercado,
        forma_id: ana.pix,
      });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
      expect(await parcelasNoBanco(id)).toEqual(antes);
      const rec = await pedir(app, 'POST', '/api/lancamentos/receitas', titular, {
        id,
        valor_centavos: 1,
        categoria_id: ana.salario,
        conta_id: ana.conta,
      });
      expect(await json(rec)).toMatchObject({ code: 'registro_invalido' });
    }
  });
});

describe.skipIf(!bancoDisponivel)('corrida com o mesmo id (CA-T3.3)', () => {
  it('três envios simultâneos gravam uma só vez e respondem o mesmo registro (um 201 e dois 200)', async () => {
    const { app, titular, ana } = await larParaLancar('idem.corrida');
    for (let rodada = 0; rodada < 5; rodada++) {
      const id = novoId();
      const corpo = { id, valor_centavos: 3_000, categoria_id: ana.mercado, forma_id: ana.credito, parcelas: 3 };
      const respostas = await Promise.all([1, 2, 3].map(() => pedir(app, 'POST', DESPESAS, titular, corpo)));
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 200, 201]);
      const corpos = await Promise.all(respostas.map((r) => json<Record<string, unknown>>(r)));
      const semFlag = corpos.map((c) => ({ ...c, ja_existia: null }));
      expect(semFlag[1]).toEqual(semFlag[0]);
      expect(semFlag[2]).toEqual(semFlag[0]);
      expect(await contar('parcela', 'lancamento_id', id)).toBe(3);
    }
  });
});

describe.skipIf(!bancoDisponivel)('pagamento de cartão (SDD #15; RN-13; CA-13.5)', () => {
  it('debita a conta de origem uma única vez; o reenvio devolve { id, ja_existia: true } com 200', async () => {
    const { app, titular, ana } = await larParaLancar('cartao.pag');
    const antes = await saldoDe(app, titular, ana.conta);
    const corpo = { id: novoId(), conta_id: ana.conta, valor_centavos: 2_500, data: '2026-01-10' };
    const r1 = await pedir(app, 'POST', `/api/formas/${ana.credito}/pagamentos`, titular, corpo);
    expect(r1.status).toBe(201);
    expect(await json(r1)).toEqual({ id: corpo.id, ja_existia: false });
    const r2 = await pedir(app, 'POST', `/api/formas/${ana.credito}/pagamentos`, titular, {
      ...corpo,
      valor_centavos: 9,
    });
    expect(r2.status).toBe(200);
    expect(await json(r2)).toEqual({ id: corpo.id, ja_existia: true });
    expect(await contar('movimento_conta', 'id', corpo.id)).toBe(1);
    expect(await saldoDe(app, titular, ana.conta)).toBe(antes - 2_500);
  });

  it('forma que não é Crédito, forma ou conta de outro membro, conta arquivada → registro_invalido; forma arquivada é aceita; valor 0 é valor_invalido', async () => {
    const { app, titular, ana, bruno } = await larParaLancar('cartao.recusas');
    const pagar = (forma: string, conta: string, valor = 100) =>
      pedir(app, 'POST', `/api/formas/${forma}/pagamentos`, titular, {
        id: novoId(),
        conta_id: conta,
        valor_centavos: valor,
      });
    for (const [forma, conta] of [
      [ana.pix, ana.conta],
      [bruno.credito, ana.conta],
      [ana.credito, bruno.conta],
      [novoId(), ana.conta],
    ] as const) {
      expect(await json(await pagar(forma, conta)), `${forma} ${conta}`).toMatchObject({ code: 'registro_invalido' });
    }
    expect(await json(await pagar(ana.credito, ana.conta, 0))).toMatchObject({ code: 'valor_invalido' });
    await pedir(app, 'POST', `/api/formas/${ana.credito}/arquivar`, titular);
    expect((await pagar(ana.credito, ana.conta)).status).toBe(201);
    await pedir(app, 'POST', `/api/contas/${ana.conta}/arquivar`, titular);
    expect(await json(await pagar(ana.credito, ana.conta))).toMatchObject({ code: 'registro_invalido' });
  });

  it('o id de um pagamento do outro membro → registro_invalido', async () => {
    const { app, titular, membro, ana, bruno } = await larParaLancar('cartao.alheio');
    const id = novoId();
    expect(
      (
        await pedir(app, 'POST', `/api/formas/${bruno.credito}/pagamentos`, membro, {
          id,
          conta_id: bruno.conta,
          valor_centavos: 10,
        })
      ).status,
    ).toBe(201);
    const r = await pedir(app, 'POST', `/api/formas/${ana.credito}/pagamentos`, titular, {
      id,
      conta_id: ana.conta,
      valor_centavos: 10,
    });
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
  });
});
