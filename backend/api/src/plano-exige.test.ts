import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { ESCRITAS_PRO } from './entrada/rotas/orcamento-metas';
import { bancoDisponivel } from './testes-suporte';
import { linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';
import { criarMeta, definirOrcamento, movimentar, novoId, type App } from './testes-suporte-orcamento-metas';
import { DIA, larAtivo, larDePlano, mercadoDe, meuPlano } from './testes-suporte-plano';

/**
 * `exigePlano('pro')` nas escritas de orçamento e metas (RN-25; SDD 5.1 passo 9, 5.4; CA-25.1 a CA-25.5, CA-T2.3;
 * G-30; TM-API-09). Chamadas direto na API: esconder o botão não protege.
 */

const OUT = '2026-10-01';

async function contar(tabela: 'orcamento' | 'meta' | 'movimento_meta', larId: string): Promise<number> {
  const coluna =
    tabela === 'movimento_meta'
      ? sql`meta_id in (select id from app.meta where lar_id = ${larId})`
      : sql`lar_id = ${larId}`;
  const [r] = await linhasComoOwner(
    sql<{ n: number }>`select count(*)::int as n from app.${sql.raw(tabela)} where ${coluna}`,
  );
  return r?.n ?? 0;
}

/** As 4 escritas, cada uma com um corpo válido. */
function escritas(app: App, quem: Pessoa, mercado: string, meta: string) {
  return [
    () => definirOrcamento(app, quem, OUT, mercado, 10_000),
    () => pedir(app, 'POST', `/api/orcamento/${OUT}/copiar`, quem, { escopo: 'conjunto' }),
    () => pedir(app, 'PUT', `/api/metas/${novoId()}`, quem, { nome: 'Nova', alvo_centavos: 1000, escopo: 'conjunto' }),
    () => movimentar(app, quem, meta),
  ];
}

describe.skipIf(!bancoDisponivel)('Free: orçamento e metas somente leitura (RN-25)', () => {
  it('as 4 escritas respondem 403 plano_necessario para os dois membros e nada é gravado (CA-25.2, CA-25.3)', async () => {
    const l = await larDePlano('exige.free', { comMembro: true, trialJaUsado: true });
    expect((await meuPlano(l.app, l.titular)).plano).toBe('free');
    const mercado = await mercadoDe(l.app, l.titular);
    // Uma meta antiga (gravada direto no banco, como se viesse do tempo do Pro).
    const meta = novoId();
    await linhasComoOwner(sql`
      insert into app.meta (id, lar_id, dono_id, escopo, nome, alvo_centavos)
      select ${meta}, ${l.larId}, m.id, 'conjunto', 'Antiga', 5000
        from app.membro m where m.lar_id = ${l.larId} and m.papel = 'titular' and m.saiu_em is null
      returning id`);
    expect(ESCRITAS_PRO).toHaveLength(4);
    for (const quem of [l.titular, l.membro!]) {
      for (const escrever of escritas(l.app, quem, mercado, meta)) {
        const r = await escrever();
        expect(r.status).toBe(403);
        expect(await r.json()).toMatchObject({ code: 'plano_necessario' });
      }
    }
    expect(await contar('orcamento', l.larId)).toBe(0);
    expect(await contar('meta', l.larId)).toBe(1);
    expect(await contar('movimento_meta', l.larId)).toBe(0);
  });

  it('a recusa do plano vem antes de registro_invalido e de valor_invalido (RT-02; CA-T2.3)', async () => {
    const l = await larDePlano('exige.ordem', { trialJaUsado: true });
    const casos = [
      () => definirOrcamento(l.app, l.titular, OUT, novoId(), 10_000),
      () => pedir(l.app, 'PUT', `/api/orcamento/mes-ruim/nao-e-uuid`, l.titular, { valor_centavos: -1 }),
      () => pedir(l.app, 'POST', `/api/orcamento/${OUT}/copiar`, l.titular, {}),
      () => pedir(l.app, 'PUT', '/api/metas/nao-e-uuid', l.titular, {}),
      () => pedir(l.app, 'POST', `/api/metas/${novoId()}/movimentos`, l.titular, { valor_centavos: 'x' }),
    ];
    for (const caso of casos) {
      const r = await caso();
      expect(r.status).toBe(403);
      expect(await r.json()).toMatchObject({ code: 'plano_necessario' });
    }
  });

  it('as leituras continuam: orçamento e metas existentes aparecem com o realizado (CA-25.1)', async () => {
    // Pro (trial) grava; depois do trial, Free só lê.
    const l = await larDePlano('exige.leitura', { comMembro: true });
    const mercado = await mercadoDe(l.app, l.titular);
    expect((await definirOrcamento(l.app, l.titular, OUT, mercado, 30_000)).status).toBe(204);
    const meta = await criarMeta(l.app, l.titular, { nome: 'Viagem' });
    expect((await movimentar(l.app, l.membro!, meta, { valor_centavos: 2_000 })).status).toBe(201);
    await l.avancar(14 * DIA);
    expect((await meuPlano(l.app, l.titular)).plano).toBe('free');
    for (const quem of [l.titular, l.membro!]) {
      const o = await pedir(l.app, 'GET', `/api/orcamento?mes=${OUT}`, quem);
      expect(o.status).toBe(200);
      expect((await o.json()) as { linhas: unknown[] }).toMatchObject({
        linhas: [{ categoria_id: mercado, orcado_centavos: 30_000 }],
      });
      const m = await pedir(l.app, 'GET', `/api/metas/${meta}`, quem);
      expect(m.status).toBe(200);
      expect(await m.json()).toMatchObject({ nome: 'Viagem', guardado_centavos: 2_000 });
      expect((await pedir(l.app, 'GET', '/api/metas', quem)).status).toBe(200);
      expect((await pedir(l.app, 'GET', `/api/metas/${meta}/movimentos`, quem)).status).toBe(200);
    }
    // Escrever, agora, não.
    expect((await definirOrcamento(l.app, l.titular, OUT, mercado, 1)).status).toBe(403);
    // Lançamentos, contas e o resto continuam livres (RN-25).
    expect((await pedir(l.app, 'GET', '/api/resumo', l.titular)).status).toBe(200);
  });
});

describe.skipIf(!bancoDisponivel)('Pro: as escritas passam (RN-25, nos dois sentidos)', () => {
  it('no trial as 4 escritas passam', async () => {
    const l = await larDePlano('exige.trial', { comMembro: true });
    const mercado = await mercadoDe(l.app, l.titular);
    const meta = await criarMeta(l.app, l.titular);
    const status = [];
    for (const escrever of escritas(l.app, l.membro!, mercado, meta)) status.push((await escrever()).status);
    expect(status).toEqual([204, 200, 201, 201]);
  });

  it('o lar que volta ao Pro encontra tudo intacto e editável (CA-25.4)', async () => {
    const l = await larDePlano('exige.volta', { trialJaUsado: true });
    const mercado = await mercadoDe(l.app, l.titular);
    await linhasComoOwner(sql`
      insert into app.orcamento (lar_id, categoria_id, mes, escopo, valor_centavos)
      values (${l.larId}, ${mercado}, ${OUT}, 'conjunto', 12345)
      returning id`);
    expect((await definirOrcamento(l.app, l.titular, OUT, mercado, 1)).status).toBe(403);
    const ativo = await larAtivo('exige.volta.ativo');
    expect((await meuPlano(ativo.app, ativo.titular)).plano).toBe('pro');
    const mercadoAtivo = await mercadoDe(ativo.app, ativo.titular);
    expect((await definirOrcamento(ativo.app, ativo.titular, OUT, mercadoAtivo, 5_000)).status).toBe(204);
    // O orçamento do lar Free ficou como estava (nada apagado).
    const [o] = await linhasComoOwner(
      sql<{ v: number }>`select valor_centavos::int as v from app.orcamento where lar_id = ${l.larId}`,
    );
    expect(o?.v).toBe(12345);
  });

  it('atrasada dentro da carência ainda escreve; cancelada até o fim do período também', async () => {
    const l = await larAtivo('exige.cancelada');
    const mercado = await mercadoDe(l.app, l.titular);
    expect((await pedir(l.app, 'POST', '/api/plano/cancelar', l.titular)).status).toBe(204);
    expect((await definirOrcamento(l.app, l.titular, OUT, mercado, 100)).status).toBe(204);
    await l.avancar(31 * DIA);
    expect((await definirOrcamento(l.app, l.titular, OUT, mercado, 200)).status).toBe(403);
    const [o] = await linhasComoOwner(
      sql<{ v: number }>`select valor_centavos::int as v from app.orcamento where lar_id = ${l.larId}`,
    );
    expect(o?.v).toBe(100);
  });
});
