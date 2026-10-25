import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { criarCategoria, listar } from './testes-suporte-cadastros';
import { criarFixa, ocorrenciaDe, pagarOk } from './testes-suporte-fixas';
import { lancarDespesa, parcelasNoBanco } from './testes-suporte-lancamentos';
import { appDeLar, criarLarDe, json, pedir, pessoa, tokenDoConvite } from './testes-suporte-lar';
import {
  criarMeta,
  definirOrcamento,
  definirOrcamentoOk,
  larParaOrcamento,
  novoId,
  orcamentoDoMes,
} from './testes-suporte-orcamento-metas';

/**
 * Orçamento pela API (SDD 6.1 #34 a #36; RN-16 "Orçamento", RN-17, RN-18; CA-16.5 a CA-16.7, CA-T2.1, CA-T3.5,
 * CA-T5.3, CA-23.9). "Hoje" é 24/10/2026 em São Paulo (relógio parado). Orçamento e meta ficam abertos nesta etapa
 * (o bloqueio Pro é da etapa 13).
 */

const OUT = '2026-10-01';
const NOV = '2026-11-01';
const O = (r: unknown) => saida.OrcamentoMes.parse(r);

describe.skipIf(!bancoDisponivel)('PUT /api/orcamento/:mes/:categoria_id (RN-16 "Definir")', () => {
  it('define o conjunto (204): os dois membros veem a linha, o total e o realizado zerado', async () => {
    const l = await larParaOrcamento('orc.definir');
    await definirOrcamentoOk(l.app, l.titular, '2026-10-17', l.ana.mercado, 50_000);
    for (const quem of [l.titular, l.membro]) {
      const o = O(await orcamentoDoMes(l.app, quem, OUT));
      expect(o.mes).toBe(OUT);
      expect(o.escopo).toBe('conjunto');
      expect(o.linhas).toEqual([
        {
          categoria_id: l.ana.mercado,
          nome: 'Mercado',
          orcado_centavos: 50_000,
          realizado_centavos: 0,
          percentual: 0,
          situacao: 'dentro',
        },
      ]);
      expect(o.total).toMatchObject({ orcado_centavos: 50_000, realizado_centavos: 0, resultado_centavos: 50_000 });
    }
  });

  it('o mês é normalizado para o dia 1; redefinir troca o valor (uma linha só)', async () => {
    const l = await larParaOrcamento('orc.normaliza');
    await definirOrcamentoOk(l.app, l.titular, '2026-10-31', l.ana.mercado, 10_000);
    await definirOrcamentoOk(l.app, l.membro, '2026-10-02', l.ana.mercado, 20_000);
    const o = await orcamentoDoMes(l.app, l.titular, '2026-10-15');
    expect(o.linhas.map((x) => [x.nome, x.orcado_centavos])).toEqual([['Mercado', 20_000]]);
  });

  it('valor nulo, ausente ou categoria sem orçamento: remove, de forma idempotente (CA-T3.5)', async () => {
    const l = await larParaOrcamento('orc.remover');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 10_000);
    expect((await definirOrcamento(l.app, l.titular, OUT, l.ana.mercado, null)).status).toBe(204);
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).total).toBeNull();
    expect((await definirOrcamento(l.app, l.titular, OUT, l.ana.mercado, null)).status).toBe(204);
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 10_000);
    expect((await definirOrcamento(l.app, l.titular, OUT, l.ana.mercado)).status).toBe(204);
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).linhas).toEqual([]);
  });

  it('ordem das recusas: categoria inexistente, de receita ou individual do outro → registro_invalido, mesmo com valor inválido', async () => {
    const l = await larParaOrcamento('orc.ordem');
    for (const categoria of [novoId(), l.ana.salario, l.bruno.lazer]) {
      for (const valor of [10_000, 0]) {
        const r = await definirOrcamento(l.app, l.titular, OUT, categoria, valor);
        expect(r.status, `${categoria} ${valor}`).toBe(404);
        expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
      }
    }
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).total).toBeNull();
    expect((await orcamentoDoMes(l.app, l.titular, OUT, 'individual')).total).toBeNull();
  });

  it('valor_invalido: zero, negativo, fracionado ou acima de 10^11; mês inexistente; chave desconhecida no corpo', async () => {
    const l = await larParaOrcamento('orc.invalido');
    for (const valor of [0, -5, 1.5, 100_000_000_001]) {
      const r = await definirOrcamento(l.app, l.titular, OUT, l.ana.mercado, valor);
      expect(r.status, String(valor)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
    expect((await definirOrcamento(l.app, l.titular, '2026-02-30', l.ana.mercado, 100)).status).toBe(400);
    expect((await definirOrcamento(l.app, l.titular, 'outubro', l.ana.mercado, 100)).status).toBe(400);
    const r = await pedir(l.app, 'PUT', `/api/orcamento/${OUT}/${l.ana.mercado}`, l.titular, {
      valor_centavos: 100,
      escopo: 'individual',
    });
    expect(r.status).toBe(400);
    // id de categoria malformado vale como inexistente (RT-01)
    const m = await definirOrcamento(l.app, l.titular, OUT, 'x', 100);
    expect(m.status).toBe(404);
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).total).toBeNull();
    // o teto de 10^11 é aceito
    expect((await definirOrcamento(l.app, l.titular, OUT, l.ana.mercado, 100_000_000_000)).status).toBe(204);
  });

  it('categoria arquivada aceita a remoção, mas não recebe valor (registro_invalido)', async () => {
    const l = await larParaOrcamento('orc.arquivada');
    const cat = await criarCategoria(l.app, l.titular, { nome: 'Pets', tipo: 'despesa', escopo: 'conjunto' });
    await definirOrcamentoOk(l.app, l.titular, OUT, cat, 5_000);
    expect((await pedir(l.app, 'POST', `/api/categorias/${cat}/arquivar`, l.titular)).status).toBe(204);
    const r = await definirOrcamento(l.app, l.titular, OUT, cat, 9_000);
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).linhas[0]).toMatchObject({ orcado_centavos: 5_000 });
    expect((await definirOrcamento(l.app, l.titular, OUT, cat, null)).status).toBe(204);
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).linhas).toEqual([]);
  });

  it('sem sessão 401; sem lar 409 sem_lar', async () => {
    const l = await larParaOrcamento('orc.sessao');
    expect((await definirOrcamento(l.app, null as never, OUT, l.ana.mercado, 1)).status).toBe(401);
    const sozinho = await pessoa('orc.semlar');
    const r = await definirOrcamento(l.app, sozinho, OUT, l.ana.mercado, 1);
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'sem_lar' });
    expect((await pedir(l.app, 'GET', '/api/orcamento', sozinho)).status).toBe(409);
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/orcamento: realizado, situação e totais (RN-16)', () => {
  it('tabela da RN-16: 7.999 dentro; 8.000 atenção; 10.000 atenção (100%); 10.001 estourado (exibe 100)', async () => {
    const l = await larParaOrcamento('orc.situacao');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 10_000);
    const gasta = (valor: number) =>
      lancarDespesa(l.app, l.titular, {
        valor_centavos: valor,
        categoria_id: l.ana.mercado,
        forma_id: l.ana.pix,
        data: '2026-10-10',
      });
    const linha = async () => (await orcamentoDoMes(l.app, l.membro, OUT)).linhas[0]!;

    await gasta(7_999);
    expect(await linha()).toMatchObject({ realizado_centavos: 7_999, percentual: 80, situacao: 'dentro' });
    await gasta(1);
    expect(await linha()).toMatchObject({ realizado_centavos: 8_000, percentual: 80, situacao: 'atencao' });
    await gasta(2_000);
    expect(await linha()).toMatchObject({ realizado_centavos: 10_000, percentual: 100, situacao: 'atencao' });
    await gasta(1);
    expect(await linha()).toMatchObject({ realizado_centavos: 10_001, percentual: 100, situacao: 'estourado' });
    const o = await orcamentoDoMes(l.app, l.titular, OUT);
    expect(o.total).toMatchObject({ situacao: 'estourado', resultado_centavos: -1 });
  });

  it('CA-16.6: orçamento só de Mercado e gasto em Moradia → o realizado do total inclui Moradia; a linha não', async () => {
    const l = await larParaOrcamento('orc.ca166');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 100_000);
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 30_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-03',
    });
    await lancarDespesa(l.app, l.membro, {
      valor_centavos: 70_000,
      categoria_id: l.moradia,
      forma_id: l.bruno.pix,
      data: '2026-10-04',
    });
    const o = await orcamentoDoMes(l.app, l.membro, OUT);
    expect(o.linhas.map((x) => [x.nome, x.realizado_centavos])).toEqual([['Mercado', 30_000]]);
    expect(o.total).toMatchObject({
      orcado_centavos: 100_000,
      realizado_centavos: 100_000,
      percentual: 100,
      situacao: 'atencao',
      resultado_centavos: 0,
      parcial: true,
    });
    expect(o.sem_orcamento.map((x) => x.nome)).toContain('Moradia');
    expect(o.sem_orcamento.map((x) => x.nome)).not.toContain('Mercado');
  });

  it('CA-16.5: compra em 3x conta no orçamento só pela parcela do mês, nunca pelo valor total', async () => {
    const l = await larParaOrcamento('orc.ca165');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 30_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-10-05',
    });
    const parcelas = await parcelasNoBanco(id);
    expect(parcelas).toHaveLength(3);
    const segunda = parcelas[1]!;
    const mes = `${segunda.data.slice(0, 7)}-01`;
    await definirOrcamentoOk(l.app, l.titular, mes, l.ana.mercado, 50_000);
    const o = await orcamentoDoMes(l.app, l.titular, mes);
    const doMes = parcelas.filter((p) => p.data.startsWith(mes.slice(0, 7))).reduce((s, p) => s + p.valor_centavos, 0);
    expect(o.linhas[0]!.realizado_centavos).toBe(doMes);
    expect(doMes).toBeLessThan(30_000);
  });

  it('ordena por percentual decrescente e depois por nome; sem_orcamento lista as categorias de despesa não arquivadas, por nome', async () => {
    const l = await larParaOrcamento('orc.ordem.linhas');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 100_000);
    await definirOrcamentoOk(l.app, l.titular, OUT, l.moradia, 100_000);
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 60_000,
      categoria_id: l.moradia,
      forma_id: l.ana.pix,
      data: '2026-10-02',
    });
    const o = await orcamentoDoMes(l.app, l.titular, OUT);
    expect(o.linhas.map((x) => x.nome)).toEqual(['Moradia', 'Mercado']);
    const nomes = o.sem_orcamento.map((x) => x.nome);
    expect(nomes).not.toContain('Mercado');
    expect(nomes).not.toContain('Moradia');
    expect([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(nomes);
    expect(nomes.length).toBeGreaterThan(0);
  });

  it('mês sem orçamento: total nulo, linhas vazias, parcial só enquanto o mês não fechou', async () => {
    const l = await larParaOrcamento('orc.vazio');
    const o = await orcamentoDoMes(l.app, l.titular, OUT);
    expect(o.total).toBeNull();
    expect(o.linhas).toEqual([]);
    expect(o.pode_copiar_anterior).toEqual({ conjunto: false, individual: false });
    expect(o.anterior).toBeUndefined();
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.ana.mercado, 1_000);
    expect((await orcamentoDoMes(l.app, l.titular, '2026-09-01')).total).toMatchObject({ parcial: false });
    await definirOrcamentoOk(l.app, l.titular, '2026-12-01', l.ana.mercado, 1_000);
    expect((await orcamentoDoMes(l.app, l.titular, '2026-12-01')).total).toMatchObject({ parcial: true });
  });

  it('escopo ou mês inválidos na consulta → valor_invalido', async () => {
    const l = await larParaOrcamento('orc.filtro');
    expect((await pedir(l.app, 'GET', '/api/orcamento?escopo=todos', l.titular)).status).toBe(400);
    expect((await pedir(l.app, 'GET', '/api/orcamento?mes=2026-02-30', l.titular)).status).toBe(400);
    expect((await pedir(l.app, 'GET', '/api/orcamento?lar_id=x', l.titular)).status).toBe(400);
    // sem mês: o mês corrente (24/10/2026)
    expect((await orcamentoDoMes(l.app, l.titular)).mes).toBe(OUT);
  });
});

describe.skipIf(!bancoDisponivel)(
  'orçamento individual: só do dono, só categorias individuais (RN-16c, RN-16e)',
  () => {
    it('A define o individual; B não o vê e o conjunto continua igual para os dois', async () => {
      const l = await larParaOrcamento('orc.individual');
      await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.lazer, 20_000);
      await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 50_000);
      const deAna = await orcamentoDoMes(l.app, l.titular, OUT, 'individual');
      expect(deAna.linhas.map((x) => [x.nome, x.orcado_centavos])).toEqual([['Lazer pessoal', 20_000]]);
      const deBruno = await orcamentoDoMes(l.app, l.membro, OUT, 'individual');
      expect(deBruno.total).toBeNull();
      expect(deBruno.linhas).toEqual([]);
      expect(JSON.stringify(deBruno)).not.toContain(l.ana.lazer);
      for (const quem of [l.titular, l.membro]) {
        expect((await orcamentoDoMes(l.app, quem, OUT)).linhas.map((x) => x.nome)).toEqual(['Mercado']);
      }
    });

    it('B não define nem remove o orçamento da categoria individual de A, com a resposta de id inexistente', async () => {
      const l = await larParaOrcamento('orc.alheio');
      await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.lazer, 20_000);
      const alheia = await definirOrcamento(l.app, l.membro, OUT, l.ana.lazer, 1);
      const inexistente = await definirOrcamento(l.app, l.membro, OUT, novoId(), 1);
      expect([alheia.status, await alheia.text()]).toEqual([inexistente.status, await inexistente.text()]);
      expect(alheia.status).toBe(404);
      expect((await definirOrcamento(l.app, l.membro, OUT, l.ana.lazer, null)).status).toBe(404);
      expect((await orcamentoDoMes(l.app, l.titular, OUT, 'individual')).linhas[0]).toMatchObject({
        orcado_centavos: 20_000,
      });
    });

    it('o realizado individual é só das despesas individuais do membro; a parte dele no conjunto não entra', async () => {
      const l = await larParaOrcamento('orc.realizado.ind');
      await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.lazer, 20_000);
      await lancarDespesa(l.app, l.titular, {
        valor_centavos: 5_000,
        categoria_id: l.ana.lazer,
        forma_id: l.ana.pix,
        data: '2026-10-02',
      });
      await lancarDespesa(l.app, l.titular, {
        valor_centavos: 9_000,
        categoria_id: l.ana.mercado,
        forma_id: l.ana.pix,
        data: '2026-10-02',
      });
      await lancarDespesa(l.app, l.membro, {
        valor_centavos: 7_000,
        categoria_id: l.bruno.lazer,
        forma_id: l.bruno.pix,
        data: '2026-10-02',
      });
      const o = await orcamentoDoMes(l.app, l.titular, OUT, 'individual');
      expect(o.total).toMatchObject({ orcado_centavos: 20_000, realizado_centavos: 5_000, resultado_centavos: 15_000 });
    });

    it('o escopo individual no orçamento do outro membro não vaza nem por pode_copiar_anterior', async () => {
      const l = await larParaOrcamento('orc.pode.vaza');
      await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.ana.lazer, 20_000);
      expect((await orcamentoDoMes(l.app, l.titular, OUT)).pode_copiar_anterior).toEqual({
        conjunto: false,
        individual: true,
      });
      expect((await orcamentoDoMes(l.app, l.membro, OUT)).pode_copiar_anterior).toEqual({
        conjunto: false,
        individual: false,
      });
    });
  },
);

describe.skipIf(!bancoDisponivel)('POST /api/orcamento/:mes/copiar (RN-16 "Copiar"; CA-16.7)', () => {
  it('copia o conjunto do mês anterior, B passa a ver as linhas e pode_copiar_anterior fica falso', async () => {
    const l = await larParaOrcamento('orc.copiar');
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.ana.mercado, 40_000);
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.moradia, 90_000);
    const antes = await orcamentoDoMes(l.app, l.membro, OUT);
    expect(antes.pode_copiar_anterior.conjunto).toBe(true);
    expect(antes.anterior).toEqual({ mes: '2026-09-01', orcado_centavos: 130_000, categorias: 2 });

    const r = await pedir(l.app, 'POST', `/api/orcamento/${OUT}/copiar`, l.titular, { escopo: 'conjunto' });
    expect(r.status).toBe(200);
    expect(saida.CopiaDeOrcamento.parse(await json(r))).toEqual({ copiadas: 2 });
    const depois = await orcamentoDoMes(l.app, l.membro, OUT);
    expect(depois.linhas.map((x) => [x.nome, x.orcado_centavos]).sort()).toEqual([
      ['Mercado', 40_000],
      ['Moradia', 90_000],
    ]);
    expect(depois.pode_copiar_anterior.conjunto).toBe(false);
    expect(depois.anterior).toBeUndefined();
  });

  it('CA-16.7: não sobrescreve o que o mês já tem; copia só o que falta; repetir devolve 0', async () => {
    const l = await larParaOrcamento('orc.ca167');
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.ana.mercado, 40_000);
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.moradia, 90_000);
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.mercado, 11_111);
    const corpo = { escopo: 'conjunto' };
    const r = await pedir(l.app, 'POST', `/api/orcamento/${OUT}/copiar`, l.membro, corpo);
    expect(await json(r)).toEqual({ copiadas: 1 });
    const o = await orcamentoDoMes(l.app, l.titular, OUT);
    expect(o.linhas.map((x) => [x.nome, x.orcado_centavos]).sort()).toEqual([
      ['Mercado', 11_111],
      ['Moradia', 90_000],
    ]);
    const de_novo = await pedir(l.app, 'POST', `/api/orcamento/${OUT}/copiar`, l.membro, corpo);
    expect(await json(de_novo)).toEqual({ copiadas: 0 });
  });

  it('pula categoria arquivada; sem mês anterior devolve 0', async () => {
    const l = await larParaOrcamento('orc.copiar.arq');
    const cat = await criarCategoria(l.app, l.titular, { nome: 'Pets', tipo: 'despesa', escopo: 'conjunto' });
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', cat, 1_000);
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.ana.mercado, 2_000);
    await pedir(l.app, 'POST', `/api/categorias/${cat}/arquivar`, l.titular);
    const r = await pedir(l.app, 'POST', `/api/orcamento/${OUT}/copiar`, l.titular, { escopo: 'conjunto' });
    expect(await json(r)).toEqual({ copiadas: 1 });
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).linhas.map((x) => x.nome)).toEqual(['Mercado']);
    const vazio = await pedir(l.app, 'POST', `/api/orcamento/2027-05-01/copiar`, l.titular, { escopo: 'conjunto' });
    expect(await json(vazio)).toEqual({ copiadas: 0 });
  });

  it('B copia o individual dele sem receber nem criar orçamento das categorias de A', async () => {
    const l = await larParaOrcamento('orc.copiar.ind');
    await definirOrcamentoOk(l.app, l.titular, '2026-09-01', l.ana.lazer, 20_000);
    await definirOrcamentoOk(l.app, l.membro, '2026-09-01', l.bruno.lazer, 7_000);
    const r = await pedir(l.app, 'POST', `/api/orcamento/${OUT}/copiar`, l.membro, { escopo: 'individual' });
    expect(await json(r)).toEqual({ copiadas: 1 });
    const deBruno = await orcamentoDoMes(l.app, l.membro, OUT, 'individual');
    expect(deBruno.linhas.map((x) => [x.nome, x.orcado_centavos])).toEqual([['Lazer pessoal', 7_000]]);
    expect((await orcamentoDoMes(l.app, l.titular, OUT, 'individual')).linhas).toEqual([]);
  });

  it('valor_invalido: escopo ausente ou desconhecido, mês inexistente', async () => {
    const l = await larParaOrcamento('orc.copiar.inv');
    for (const corpo of [{}, { escopo: 'todos' }, { escopo: 'conjunto', lar_id: novoId() }]) {
      expect((await pedir(l.app, 'POST', `/api/orcamento/${OUT}/copiar`, l.titular, corpo)).status).toBe(400);
    }
    expect(
      (await pedir(l.app, 'POST', `/api/orcamento/2026-13-01/copiar`, l.titular, { escopo: 'conjunto' })).status,
    ).toBe(400);
  });
});

describe.skipIf(!bancoDisponivel)('categoria com orçamento (RN-17): pode_excluir e categoria_em_uso', () => {
  it('com orçamento a categoria não pode ser excluída (409 categoria_em_uso); sem ele, pode', async () => {
    const l = await larParaOrcamento('orc.categoria');
    const cat = await criarCategoria(l.app, l.titular, { nome: 'Pets', tipo: 'despesa', escopo: 'conjunto' });
    const pode = async () =>
      (await listar<{ id: string; pode_excluir: boolean }>(l.app, '/api/categorias', l.membro)).find(
        (c) => c.id === cat,
      )!.pode_excluir;
    expect(await pode()).toBe(true);
    await definirOrcamentoOk(l.app, l.titular, NOV, cat, 3_000);
    expect(await pode()).toBe(false);
    const r = await pedir(l.app, 'DELETE', `/api/categorias/${cat}`, l.membro);
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'categoria_em_uso' });
    await definirOrcamentoOk(l.app, l.titular, NOV, cat, null);
    expect(await pode()).toBe(true);
    expect((await pedir(l.app, 'DELETE', `/api/categorias/${cat}`, l.membro)).status).toBe(204);
  });

  it('o mesmo vale para a categoria individual do dono', async () => {
    const l = await larParaOrcamento('orc.categoria.ind');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.lazer, 3_000);
    const cats = await listar<{ id: string; pode_excluir: boolean }>(l.app, '/api/categorias', l.titular);
    expect(cats.find((c) => c.id === l.ana.lazer)!.pode_excluir).toBe(false);
    expect((await pedir(l.app, 'DELETE', `/api/categorias/${l.ana.lazer}`, l.titular)).status).toBe(409);
  });
});

describe.skipIf(!bancoDisponivel)('lar descartável conta orçamento e meta (CA-23.9, CA-23.10)', () => {
  it('titular sozinho com UM orçamento não é descartável: o aceite dá ja_tem_lar e o orçamento fica', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('orc.convite.ana');
    await criarLarDe(app, ana);
    const bruno = await pessoa('orc.convite.bruno');
    await criarLarDe(app, bruno);
    const cats = await listar<{ id: string; nome: string; escopo: string }>(app, '/api/categorias', bruno);
    const mercado = cats.find((c) => c.nome === 'Mercado' && c.escopo === 'conjunto')!.id;
    await definirOrcamentoOk(app, bruno, OUT, mercado, 1_000);
    expect((await pedir(app, 'POST', '/api/lar/convites', ana, { email: bruno.email })).status).toBe(201);
    const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token: tokenDoConvite(caixa, bruno.email) });
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'ja_tem_lar' });
    expect((await orcamentoDoMes(app, bruno, OUT)).linhas).toHaveLength(1);
  });

  it('titular sozinho com UMA meta (sem movimento) também não é descartável', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('meta.convite.ana');
    await criarLarDe(app, ana);
    const bruno = await pessoa('meta.convite.bruno');
    await criarLarDe(app, bruno);
    const meta = await criarMeta(app, bruno, { nome: 'Reserva', escopo: 'individual' });
    expect((await pedir(app, 'POST', '/api/lar/convites', ana, { email: bruno.email })).status).toBe(201);
    const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token: tokenDoConvite(caixa, bruno.email) });
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'ja_tem_lar' });
    expect((await pedir(app, 'GET', `/api/metas/${meta}`, bruno)).status).toBe(200);
  });
});

describe.skipIf(!bancoDisponivel)('orçamento e despesa fixa (RN-15, RN-16a, RN-28)', () => {
  it('a ocorrência pendente não entra no realizado; paga, entra pelo vencimento na categoria conjunta', async () => {
    const l = await larParaOrcamento('orc.fixa');
    await definirOrcamentoOk(l.app, l.titular, OUT, l.moradia, 200_000);
    const fixa = await criarFixa(l.app, l.titular, {
      categoria_id: l.moradia,
      valor_previsto_centavos: 150_000,
      dia_vencimento: 10,
    });
    const o = await ocorrenciaDe(l.app, l.titular, fixa, OUT);
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).linhas[0]).toMatchObject({
      nome: 'Moradia',
      realizado_centavos: 0,
    });
    await pagarOk(l.app, l.membro, o.id, { forma_id: l.bruno.pix });
    expect((await orcamentoDoMes(l.app, l.titular, OUT)).linhas[0]).toMatchObject({
      nome: 'Moradia',
      realizado_centavos: 150_000,
      percentual: 75,
      situacao: 'dentro',
    });
  });
});
