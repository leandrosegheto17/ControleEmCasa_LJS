import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { criarCategoria, listar } from './testes-suporte-cadastros';
import { resumo } from './testes-suporte-fixas';
import { lancarDespesa, lancarReceita } from './testes-suporte-lancamentos';
import { criarMeta, definirOrcamentoOk, larParaOrcamento, movimentarOk } from './testes-suporte-orcamento-metas';

/**
 * `GET /api/resumo` com orçamento, metas e "guardado no mês" (SDD 6.1 #33; RN-08, RN-16, RN-16c, RN-16d, RN-25;
 * CA-08.6, CA-16.10, CA-25.1). "Hoje" é 24/10/2026 em São Paulo. Fecha a pendência da etapa 9: os blocos
 * `orcamento` e `metas` e o `guardado_no_mes_centavos` deixam de vir vazios.
 */

const OUT = '2026-10-01';
const R = (r: unknown) => saida.ResumoMes.parse(r);

describe.skipIf(!bancoDisponivel)('resumo: orçamento do conjunto e do individual (RN-16, RN-16c, RN-16d)', () => {
  it('sem orçamento os blocos são nulos e o resultado conjunto é 0 − total do casal (como na etapa 9)', async () => {
    const l = await larParaOrcamento('resorc.vazio');
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 3_000,
      categoria_id: l.moradia,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    const r = R(await resumo(l.app, l.membro, OUT));
    expect(r.conjunto.orcamento).toBeNull();
    expect(r.individual.orcamento).toBeNull();
    expect(r.conjunto.resultado.valor_centavos).toBe(-3_000);
  });

  it('conjunto: total do escopo, realizado de TODAS as despesas e as 3 maiores linhas como destaques; resultado = orçado − total do casal', async () => {
    const l = await larParaOrcamento('resorc.conjunto');
    const pets = await criarCategoria(l.app, l.titular, { nome: 'Pets', tipo: 'despesa', escopo: 'conjunto' });
    const gasta = (categoria: string, valor: number) =>
      lancarDespesa(l.app, l.titular, {
        valor_centavos: valor,
        categoria_id: categoria,
        forma_id: l.ana.pix,
        data: '2026-10-05',
      });
    // quatro linhas: Mercado 90%, Moradia 50%, Pets 10%, e "Contas" sem gasto (0%)
    const todas = await listar<{ id: string; nome: string; escopo: string }>(l.app, '/api/categorias', l.titular);
    const conjunta = (nome: string) => todas.find((c) => c.nome === nome && c.escopo === 'conjunto')!.id;
    const contas = conjunta('Contas da casa');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 10_000);
    await definirOrcamentoOk(l.app, l.titular, OUT, l.moradia, 20_000);
    await definirOrcamentoOk(l.app, l.titular, OUT, pets, 10_000);
    await definirOrcamentoOk(l.app, l.titular, OUT, contas, 5_000);
    await gasta(l.ana.mercado, 9_000);
    await gasta(l.moradia, 10_000);
    await gasta(pets, 1_000);
    // gasto fora do orçamento (CA-16.6) entra no realizado do total, não nas linhas
    await gasta(conjunta('Almoço/Alimentação fora'), 500);

    for (const quem of [l.titular, l.membro]) {
      const r = R(await resumo(l.app, quem, OUT));
      const o = r.conjunto.orcamento!;
      expect(o.orcado_centavos).toBe(45_000);
      expect(o.realizado_centavos).toBe(20_500);
      expect(o.percentual).toBe(46);
      expect(o.situacao).toBe('dentro');
      expect(o.destaques.map((d) => [d.nome, d.percentual, d.situacao])).toEqual([
        ['Mercado', 90, 'atencao'],
        ['Moradia', 50, 'dentro'],
        ['Pets', 10, 'dentro'],
      ]);
      expect(r.conjunto.total_centavos).toBe(20_500);
      expect(r.conjunto.resultado).toEqual({ valor_centavos: 45_000 - 20_500, parcial: true });
    }
  });

  it('individual: só as categorias individuais do próprio membro; o outro membro nunca vê o orçamento dela', async () => {
    const l = await larParaOrcamento('resorc.individual');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.lazer, 20_000);
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 99_999);
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 5_000,
      categoria_id: l.ana.lazer,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    // a parte dela no conjunto não entra no orçamento individual (RN-16c)
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 7_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-06',
    });
    const deAna = R(await resumo(l.app, l.titular, OUT));
    expect(deAna.individual.orcamento).toMatchObject({
      orcado_centavos: 20_000,
      realizado_centavos: 5_000,
      percentual: 25,
    });
    expect(deAna.individual.orcamento!.destaques.map((d) => d.nome)).toEqual(['Lazer pessoal']);
    expect(deAna.conjunto.orcamento).toMatchObject({ orcado_centavos: 99_999, realizado_centavos: 7_000 });

    const texto = JSON.stringify(await resumo(l.app, l.membro, OUT));
    const deBruno = R(JSON.parse(texto));
    expect(deBruno.individual.orcamento).toBeNull();
    expect(texto).not.toContain(l.ana.lazer);
    expect(texto).not.toContain('20000');
    expect(deBruno.conjunto.orcamento).toMatchObject({ orcado_centavos: 99_999 });
  });

  it('CA-25.1 (leitura aberta): o orçamento de outro mês aparece no resumo daquele mês, e meses sem orçamento ficam nulos', async () => {
    const l = await larParaOrcamento('resorc.meses');
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.ana.mercado, 10_000);
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 4_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-09-15',
    });
    const set = R(await resumo(l.app, l.titular, '2026-09-20'));
    expect(set.conjunto.orcamento).toMatchObject({ orcado_centavos: 10_000, realizado_centavos: 4_000 });
    expect(set.conjunto.resultado).toEqual({ valor_centavos: 6_000, parcial: false });
    expect(R(await resumo(l.app, l.titular, OUT)).conjunto.orcamento).toBeNull();
  });
});

describe.skipIf(!bancoDisponivel)('resumo: metas e guardado no mês (RN-08, RN-16c; CA-08.6, CA-16.10)', () => {
  it('CA-08.6: cada bloco lista o progresso ATUAL das metas visíveis, não atingidas primeiro e depois por nome, em qualquer mês', async () => {
    const l = await larParaOrcamento('resmeta.blocos');
    const b = await criarMeta(l.app, l.titular, { nome: 'Beta', alvo_centavos: 100_000, prazo: '2027-01-01' });
    const a = await criarMeta(l.app, l.titular, { nome: 'Alfa', alvo_centavos: 1_000 });
    await criarMeta(l.app, l.titular, { nome: 'Zeta', alvo_centavos: 50_000 });
    const ind = await criarMeta(l.app, l.titular, { nome: 'Da Ana', alvo_centavos: 20_000, escopo: 'individual' });
    await movimentarOk(l.app, l.titular, a, { valor_centavos: 1_000 });
    await movimentarOk(l.app, l.titular, b, { valor_centavos: 25_000, data: '2026-08-10' });
    await movimentarOk(l.app, l.titular, ind, { valor_centavos: 5_000 });

    for (const mes of ['2026-08-01', OUT, '2027-02-01']) {
      const deAna = R(await resumo(l.app, l.titular, mes));
      expect(deAna.conjunto.metas.map((m) => [m.nome, m.atingida])).toEqual([
        ['Beta', false],
        ['Zeta', false],
        ['Alfa', true],
      ]);
      expect(deAna.conjunto.metas[0]).toEqual({
        meta_id: b,
        nome: 'Beta',
        alvo_centavos: 100_000,
        guardado_centavos: 25_000,
        falta_centavos: 75_000,
        percentual: 25,
        prazo: '2027-01',
        mensal_necessario_centavos: 25_000,
        atingida: false,
      });
      expect(deAna.individual.metas).toHaveLength(1);
      expect(deAna.individual.metas[0]).toMatchObject({ meta_id: ind, guardado_centavos: 5_000, percentual: 25 });

      const deBruno = R(await resumo(l.app, l.membro, mes));
      expect(deBruno.conjunto.metas.map((m) => m.nome)).toEqual(['Beta', 'Zeta', 'Alfa']);
      expect(deBruno.individual.metas).toEqual([]);
      expect(JSON.stringify(deBruno)).not.toContain('Da Ana');
    }
  });

  it('guardado no mês: Σ aportes − Σ retiradas FEITOS POR MIM no mês, em todas as metas visíveis; pode ser negativo', async () => {
    const l = await larParaOrcamento('resmeta.guardado');
    const conjunta = await criarMeta(l.app, l.titular, { nome: 'Casa' });
    const individual = await criarMeta(l.app, l.titular, { nome: 'Da Ana', escopo: 'individual' });
    await movimentarOk(l.app, l.titular, conjunta, { valor_centavos: 20_000, data: '2026-08-10' });
    await movimentarOk(l.app, l.titular, conjunta, { valor_centavos: 10_000, data: '2026-10-02' });
    await movimentarOk(l.app, l.titular, individual, { valor_centavos: 4_000, data: '2026-10-03' });
    await movimentarOk(l.app, l.titular, conjunta, { tipo: 'retirada', valor_centavos: 3_000, data: '2026-10-04' });
    await movimentarOk(l.app, l.membro, conjunta, { valor_centavos: 1_500, data: '2026-10-05' });
    await movimentarOk(l.app, l.titular, conjunta, { tipo: 'retirada', valor_centavos: 5_000, data: '2026-09-10' });

    const de = async (quem: typeof l.titular, mes: string) =>
      R(await resumo(l.app, quem, mes)).individual.guardado_no_mes_centavos;
    expect(await de(l.titular, OUT)).toBe(11_000);
    expect(await de(l.membro, OUT)).toBe(1_500);
    expect(await de(l.titular, '2026-09-01')).toBe(-5_000);
    expect(await de(l.titular, '2026-08-01')).toBe(20_000);
    expect(await de(l.membro, '2026-09-01')).toBe(0);
    expect(await de(l.titular, '2026-11-01')).toBe(0);
  });

  it('CA-16.10: o aporte em meta não reduz o resultado individual', async () => {
    const l = await larParaOrcamento('resmeta.resultado');
    await lancarReceita(l.app, l.titular, {
      valor_centavos: 500_000,
      categoria_id: l.ana.salario,
      conta_id: l.ana.conta,
      data: '2026-10-01',
    });
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 50_000,
      categoria_id: l.ana.lazer,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    const antes = R(await resumo(l.app, l.titular, OUT)).individual;
    const meta = await criarMeta(l.app, l.titular, { nome: 'Casa' });
    await movimentarOk(l.app, l.titular, meta, { valor_centavos: 100_000, data: '2026-10-06' });
    const depois = R(await resumo(l.app, l.titular, OUT)).individual;
    expect(depois.resultado.valor_centavos).toBe(450_000);
    expect(depois.resultado).toEqual(antes.resultado);
    expect(depois.meu_total_centavos).toBe(antes.meu_total_centavos);
    expect(depois.guardado_no_mes_centavos).toBe(100_000);
  });
});
