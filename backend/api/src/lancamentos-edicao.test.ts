import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { criarCategoria, criarForma } from './testes-suporte-cadastros';
import {
  detalhe,
  lancamentoNoBanco,
  lancarDespesa,
  lancarReceita,
  larParaLancar,
  membroDe,
  novoId,
  pagamentoNoBanco,
  parcelasNoBanco,
} from './testes-suporte-lancamentos';
import { json, linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';

/**
 * Editar, alterar a data da parcela e excluir (SDD 6.1 #24 a #26; RN-06 revisada, RN-07, RN-14; G-13; TM-API-05;
 * CA-06.1 a CA-06.8, CA-07.1 a CA-07.3). RN-06 revisada pela decisão do usuário de 2026-10-25: o outro membro
 * edita só descrição, valor e categoria do mesmo escopo; a data é só do pagador; o valor novo dele mantém as datas.
 */

type Lar = Awaited<ReturnType<typeof larParaLancar>>;
const editar = (l: Lar, quem: Pessoa, id: string, corpo: unknown) =>
  pedir(l.app, 'PATCH', `/api/lancamentos/${id}`, quem, corpo);

async function codigo(r: Response): Promise<string> {
  if (r.status < 300) return String(r.status);
  return (await json<{ code: string }>(r)).code;
}

describe.skipIf(!bancoDisponivel)('matriz dono × outro membro × campo (G-13, RN-06 revisada, RN-07)', () => {
  type Cenario = 'conjunta_pix' | 'conjunta_credito' | 'individual';
  type Campo =
    | 'descricao'
    | 'valor'
    | 'data'
    | 'categoria_mesmo_escopo'
    | 'categoria_outro_escopo'
    | 'forma'
    | 'num_parcelas'
    | 'data_da_parcela'
    | 'excluir';

  /** Resultado esperado: '200'/'204' (aceito) ou o código da recusa. */
  const ESPERADO: Record<'dono' | 'outro', Record<Cenario, Record<Campo, string>>> = {
    dono: {
      conjunta_pix: {
        descricao: '200',
        valor: '200',
        data: '200',
        categoria_mesmo_escopo: '200',
        categoria_outro_escopo: '200',
        forma: '200',
        num_parcelas: 'valor_invalido', // Pix só tem 1 parcela (RN-14)
        data_da_parcela: 'registro_invalido', // só no Crédito (CA-06.7)
        excluir: '204',
      },
      conjunta_credito: {
        descricao: '200',
        valor: '200',
        data: '200',
        categoria_mesmo_escopo: '200',
        categoria_outro_escopo: '200',
        forma: '200',
        num_parcelas: '200',
        data_da_parcela: '204',
        excluir: '204',
      },
      individual: {
        descricao: '200',
        valor: '200',
        data: '200',
        categoria_mesmo_escopo: '200',
        categoria_outro_escopo: '200',
        forma: '200',
        num_parcelas: 'valor_invalido',
        data_da_parcela: 'registro_invalido',
        excluir: '204',
      },
    },
    outro: {
      conjunta_pix: {
        descricao: '200',
        valor: '200',
        data: 'sem_permissao',
        categoria_mesmo_escopo: '200',
        categoria_outro_escopo: 'sem_permissao',
        forma: 'sem_permissao',
        num_parcelas: 'sem_permissao',
        data_da_parcela: 'registro_invalido',
        excluir: '204',
      },
      conjunta_credito: {
        descricao: '200',
        valor: '200',
        data: 'sem_permissao',
        categoria_mesmo_escopo: '200',
        categoria_outro_escopo: 'sem_permissao',
        forma: 'sem_permissao',
        num_parcelas: 'sem_permissao',
        data_da_parcela: 'registro_invalido',
        excluir: '204',
      },
      individual: {
        descricao: 'registro_invalido',
        valor: 'registro_invalido',
        data: 'registro_invalido',
        categoria_mesmo_escopo: 'registro_invalido',
        categoria_outro_escopo: 'registro_invalido',
        forma: 'registro_invalido',
        num_parcelas: 'registro_invalido',
        data_da_parcela: 'registro_invalido',
        excluir: 'registro_invalido',
      },
    },
  };

  /** Uma ação por campo, sobre um lançamento novo da Ana; `quem` age. */
  async function aplicar(l: Lar, cenario: Cenario, campo: Campo, quem: Pessoa): Promise<string> {
    const outraConjunta = await criarCategoria(l.app, l.titular, {
      nome: `Outra ${novoId().slice(0, 6)}`,
      tipo: 'despesa',
      escopo: 'conjunto',
    });
    const credito = cenario === 'conjunta_credito';
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 9_000,
      categoria_id: cenario === 'individual' ? l.ana.lazer : l.ana.mercado,
      forma_id: credito ? l.ana.credito : l.ana.pix,
      parcelas: credito ? 3 : 1,
      data: '2026-10-15',
    });
    const souAna = quem === l.titular;
    // categoria do mesmo escopo / de outro escopo, visível a quem edita
    const mesmoEscopo =
      cenario === 'individual'
        ? souAna
          ? await criarCategoria(l.app, l.titular, {
              nome: `Ind ${novoId().slice(0, 6)}`,
              tipo: 'despesa',
              escopo: 'individual',
            })
          : l.bruno.lazer
        : outraConjunta;
    const outroEscopo = cenario === 'individual' ? outraConjunta : souAna ? l.ana.lazer : l.bruno.lazer;
    const minhaForma = souAna ? l.ana.credito : l.bruno.credito;
    switch (campo) {
      case 'descricao':
        return codigo(await editar(l, quem, id, { descricao: 'Nova' }));
      case 'valor':
        return codigo(await editar(l, quem, id, { valor_total_centavos: 12_000 }));
      case 'data':
        return codigo(await editar(l, quem, id, { data: '2026-10-20' }));
      case 'categoria_mesmo_escopo':
        return codigo(await editar(l, quem, id, { categoria_id: mesmoEscopo }));
      case 'categoria_outro_escopo':
        return codigo(await editar(l, quem, id, { categoria_id: outroEscopo }));
      case 'forma':
        return codigo(
          await editar(l, quem, id, {
            forma_id: credito ? (souAna ? l.ana.pix : l.bruno.pix) : minhaForma,
            num_parcelas: 1,
          }),
        );
      case 'num_parcelas':
        return codigo(await editar(l, quem, id, { num_parcelas: 2 }));
      case 'data_da_parcela': {
        const parcela = (await parcelasNoBanco(id))[0]!.id;
        return codigo(await pedir(l.app, 'PATCH', `/api/parcelas/${parcela}`, quem, { data: '2026-11-20' }));
      }
      case 'excluir':
        return codigo(await pedir(l.app, 'DELETE', `/api/lancamentos/${id}`, quem));
    }
  }

  for (const papel of ['dono', 'outro'] as const) {
    for (const cenario of ['conjunta_pix', 'conjunta_credito', 'individual'] as const) {
      it(`${papel} × ${cenario}: cada campo dá o resultado da matriz`, async () => {
        const l = await larParaLancar(`matriz.${papel}.${cenario}`);
        const quem = papel === 'dono' ? l.titular : l.membro;
        const obtido: Record<string, string> = {};
        for (const campo of Object.keys(ESPERADO[papel][cenario]) as Campo[]) {
          obtido[campo] = await aplicar(l, cenario, campo, quem);
        }
        expect(obtido).toEqual(ESPERADO[papel][cenario]);
      });
    }
  }
});

describe.skipIf(!bancoDisponivel)('PATCH /api/lancamentos/:id — critérios', () => {
  it('CA-06.1: B edita descrição e valor de uma conjunta Pix de A → aplica e grava alterado_por = B; a data e a parte privada de A não mudam', async () => {
    const l = await larParaLancar('ed.ca061');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 1_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-15',
    });
    const r = await editar(l, l.membro, id, { descricao: 'Feira do mês', valor_total_centavos: 1_500 });
    expect(r.status).toBe(200);
    const corpo = await json<Record<string, unknown>>(r);
    // resposta mínima, sem campo privado (PRD-TECNICO §2.1, D-4)
    expect(saida.LancamentoEditado.parse(corpo)).toMatchObject({ id, escopo: 'conjunto', num_parcelas: 1 });
    expect(Object.keys(corpo).sort()).toEqual(['alterado_em', 'escopo', 'id', 'num_parcelas']);
    expect(await lancamentoNoBanco(id)).toMatchObject({
      descricao: 'Feira do mês',
      valor: '1500',
      alterado_por: await membroDe(l.membro),
    });
    expect(await parcelasNoBanco(id)).toMatchObject([{ numero: 1, valor_centavos: 1_500, data: '2026-10-15' }]);
    expect(await pagamentoNoBanco(id)).toMatchObject({ data_operacao: '2026-10-15', forma_pagamento_id: l.ana.pix });
    expect(await detalhe(l.app, l.titular, id)).toMatchObject({ alterado_por: { nome: l.membro.nome } });
  });

  it('CA-06.2: B, numa conjunta no Crédito, envia data nova com descrição nova → sem_permissao e a descrição não muda', async () => {
    const l = await larParaLancar('ed.ca062');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 3_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      descricao: 'Original',
    });
    const r = await editar(l, l.membro, id, { data: '2026-01-01', descricao: 'Nova' });
    expect(r.status).toBe(403);
    expect(await json(r)).toMatchObject({ code: 'sem_permissao' });
    expect(await lancamentoNoBanco(id)).toMatchObject({ descricao: 'Original', alterado_por: null });
  });

  it('RN-06 revisada: B muda o valor de uma compra 3x com parcela ajustada → valores redistribuídos, datas mantidas (inclusive a ajustada), sem pedir confirmação', async () => {
    const l = await larParaLancar('ed.b-valor');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 3_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const p2 = (await parcelasNoBanco(id))[1]!;
    expect((await pedir(l.app, 'PATCH', `/api/parcelas/${p2.id}`, l.titular, { data: '2026-12-20' })).status).toBe(204);
    const antes = await parcelasNoBanco(id);
    const r = await editar(l, l.membro, id, { valor_total_centavos: 10_000 });
    expect(r.status).toBe(200);
    const depois = await parcelasNoBanco(id);
    expect(depois.map((p) => [p.id, p.numero, p.valor_centavos, p.data, p.data_ajustada])).toEqual([
      [antes[0]!.id, 1, 3_334, '2026-11-10', false],
      [antes[1]!.id, 2, 3_333, '2026-12-20', true],
      [antes[2]!.id, 3, 3_333, '2027-01-10', false],
    ]);
    // valor abaixo do nº de parcelas → valor_invalido
    expect(await codigo(await editar(l, l.membro, id, { valor_total_centavos: 2 }))).toBe('valor_invalido');
  });

  it('B mudando para outra categoria conjunta não recalcula nada (datas e valores ficam) e não pede confirmação', async () => {
    const l = await larParaLancar('ed.b-cat');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const p1 = (await parcelasNoBanco(id))[0]!;
    await pedir(l.app, 'PATCH', `/api/parcelas/${p1.id}`, l.titular, { data: '2026-11-25' });
    const antes = await parcelasNoBanco(id);
    const outra = await criarCategoria(l.app, l.membro, { nome: 'Casa', tipo: 'despesa', escopo: 'conjunto' });
    expect((await editar(l, l.membro, id, { categoria_id: outra })).status).toBe(200);
    expect(await parcelasNoBanco(id)).toEqual(antes);
    expect(await lancamentoNoBanco(id)).toMatchObject({ categoria_id: outra });
  });

  it('CA-06.3: B muda a forma ou o nº de parcelas → sem_permissao', async () => {
    const l = await larParaLancar('ed.ca063');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
    });
    expect(await codigo(await editar(l, l.membro, id, { forma_id: l.bruno.pix }))).toBe('sem_permissao');
    expect(await codigo(await editar(l, l.membro, id, { num_parcelas: 2 }))).toBe('sem_permissao');
    expect(await codigo(await editar(l, l.membro, id, { descricao: 'ok', num_parcelas: 2 }))).toBe('sem_permissao');
  });

  it('CA-06.4: A muda o valor de uma compra 3x com parcela ajustada: sem confirmar → confirmar_descarte_ajustes sem gravar; com confirmar → recalcula e zera os ajustes', async () => {
    const l = await larParaLancar('ed.ca064');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 3_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const p2 = (await parcelasNoBanco(id))[1]!;
    await pedir(l.app, 'PATCH', `/api/parcelas/${p2.id}`, l.titular, { data: '2026-12-25' });
    const antes = await parcelasNoBanco(id);
    const r1 = await editar(l, l.titular, id, { valor_total_centavos: 6_000 });
    expect(r1.status).toBe(409);
    expect(await json(r1)).toMatchObject({ code: 'confirmar_descarte_ajustes' });
    expect(await parcelasNoBanco(id)).toEqual(antes);
    expect(await lancamentoNoBanco(id)).toMatchObject({ valor: '3000', alterado_por: null });
    expect((await editar(l, l.titular, id, { valor_total_centavos: 6_000, confirmar_descarte: true })).status).toBe(
      200,
    );
    expect((await parcelasNoBanco(id)).map((p) => [p.valor_centavos, p.data, p.data_ajustada])).toEqual([
      [2_000, '2026-11-10', false],
      [2_000, '2026-12-10', false],
      [2_000, '2027-01-10', false],
    ]);
    // só a descrição não recalcula: não pede confirmação
    await pedir(l.app, 'PATCH', `/api/parcelas/${p2.id}`, l.titular, { data: '2026-12-25' });
    expect((await editar(l, l.titular, id, { descricao: 'Só o texto' })).status).toBe(200);
  });

  it('CA-06.5: A reduz uma compra de 5x para 3x → as parcelas 1 a 3 mantêm os ids e as 4 e 5 somem; aumentar cria as que faltam', async () => {
    const l = await larParaLancar('ed.ca065');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 5_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 5,
      data: '2026-10-15',
    });
    const antes = await parcelasNoBanco(id);
    expect((await editar(l, l.titular, id, { num_parcelas: 3 })).status).toBe(200);
    const depois = await parcelasNoBanco(id);
    expect(depois.map((p) => p.id)).toEqual(antes.slice(0, 3).map((p) => p.id));
    expect(depois.reduce((s, p) => s + p.valor_centavos, 0)).toBe(5_000);
    expect((await editar(l, l.titular, id, { num_parcelas: 4 })).status).toBe(200);
    const quatro = await parcelasNoBanco(id);
    expect(quatro.slice(0, 3).map((p) => p.id)).toEqual(depois.map((p) => p.id));
    expect(quatro.map((p) => p.data)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10']);
  });

  it('CA-06.6: cartão mudou do dia 10 para o 20 → recálculo de uma compra antiga usa o 10 (congelado); trocando a forma, usa o dia da forma nova', async () => {
    const l = await larParaLancar('ed.ca066');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 2_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 2,
      data: '2026-10-15',
    });
    await pedir(l.app, 'PUT', `/api/formas/${l.ana.credito}`, l.titular, {
      nome: 'Cartão Ana',
      tipo: 'credito',
      dia_vencimento: 20,
    });
    expect((await editar(l, l.titular, id, { valor_total_centavos: 4_000 })).status).toBe(200);
    expect((await parcelasNoBanco(id)).map((p) => p.data)).toEqual(['2026-11-10', '2026-12-10']);
    expect(await pagamentoNoBanco(id)).toMatchObject({ dia: 10 });
    const outro = await criarForma(l.app, l.titular, { nome: 'Outro cartão', tipo: 'credito', dia_vencimento: 5 });
    expect((await editar(l, l.titular, id, { forma_id: outro })).status).toBe(200);
    expect((await parcelasNoBanco(id)).map((p) => p.data)).toEqual(['2026-11-05', '2026-12-05']);
    expect(await pagamentoNoBanco(id)).toMatchObject({ forma_pagamento_id: outro, dia: 5, conta_id: null });
    // trocar para Pix exige 1 parcela e passa a debitar a conta do Pix
    expect(await codigo(await editar(l, l.titular, id, { forma_id: l.ana.pix }))).toBe('valor_invalido');
    expect((await editar(l, l.titular, id, { forma_id: l.ana.pix, num_parcelas: 1 })).status).toBe(200);
    expect(await pagamentoNoBanco(id)).toMatchObject({
      forma_pagamento_id: l.ana.pix,
      conta_id: l.ana.conta,
      dia: null,
    });
    expect((await parcelasNoBanco(id)).map((p) => [p.valor_centavos, p.data])).toEqual([[4_000, '2026-10-15']]);
  });

  it('CA-07.1: A troca a conjunta para uma individual dela → lançamento e parcelas viram individuais e somem para B', async () => {
    const l = await larParaLancar('ed.ca071');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const r = await editar(l, l.titular, id, { categoria_id: l.ana.lazer });
    expect(await json(r)).toMatchObject({ escopo: 'individual' });
    const escopos = await linhasComoOwner(
      sql<{ escopo: string }>`select distinct escopo from app.parcela where lancamento_id = ${id}`,
    );
    expect(escopos).toEqual([{ escopo: 'individual' }]);
    expect((await pedir(l.app, 'GET', `/api/lancamentos/${id}`, l.membro)).status).toBe(404);
    const lista = await json<{ quantidade: number }>(
      await pedir(l.app, 'GET', '/api/lancamentos?mes=2026-11-01', l.membro),
    );
    expect(lista.quantidade).toBe(0);
    // e volta: de individual para conjunta, aparece a B sem as chaves privadas (RN-04)
    expect((await editar(l, l.titular, id, { categoria_id: l.ana.mercado })).status).toBe(200);
    const visto = await detalhe(l.app, l.membro, id);
    expect('pagamento' in visto).toBe(false);
  });

  it('CA-07.2 e CA-07.3: B não troca a conjunta de A para uma individual de B (sem_permissao); A não usa a individual de B (registro_invalido)', async () => {
    const l = await larParaLancar('ed.ca072');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
    });
    expect(await codigo(await editar(l, l.membro, id, { categoria_id: l.bruno.lazer }))).toBe('sem_permissao');
    expect(await codigo(await editar(l, l.titular, id, { categoria_id: l.bruno.lazer }))).toBe('registro_invalido');
    expect(await codigo(await editar(l, l.titular, id, { categoria_id: l.ana.salario }))).toBe('registro_invalido');
    expect(await lancamentoNoBanco(id)).toMatchObject({ escopo: 'conjunto', categoria_id: l.ana.mercado });
  });

  it('edição sem mudança efetiva é sucesso e só grava alterado_por/alterado_em; descrição "" limpa', async () => {
    const l = await larParaLancar('ed.vazia');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-15',
      descricao: 'Texto',
    });
    const antes = await parcelasNoBanco(id);
    const r = await editar(l, l.titular, id, {
      valor_total_centavos: 300,
      data: '2026-10-15',
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
    });
    expect(r.status).toBe(200);
    expect(await parcelasNoBanco(id)).toEqual(antes);
    expect(await lancamentoNoBanco(id)).toMatchObject({ alterado_por: await membroDe(l.titular), descricao: 'Texto' });
    expect((await editar(l, l.titular, id, { descricao: '   ' })).status).toBe(200);
    expect(await lancamentoNoBanco(id)).toMatchObject({ descricao: null });
  });

  it('A muda a data de uma compra Pix: a parcela e a data da operação acompanham', async () => {
    const l = await larParaLancar('ed.data');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-15',
    });
    expect((await editar(l, l.titular, id, { data: '2026-09-30' })).status).toBe(200);
    expect(await parcelasNoBanco(id)).toMatchObject([{ data: '2026-09-30' }]);
    expect(await pagamentoNoBanco(id)).toMatchObject({ data_operacao: '2026-09-30' });
  });

  it('receita: aceita valor, data, descrição e categoria de receita; forma → registro_invalido; categoria de despesa → registro_invalido', async () => {
    const l = await larParaLancar('ed.receita');
    const id = await lancarReceita(l.app, l.titular, {
      valor_centavos: 1_000,
      categoria_id: l.ana.salario,
      conta_id: l.ana.conta,
      data: '2026-10-05',
    });
    const extra = await criarCategoria(l.app, l.titular, { nome: 'Bico', tipo: 'receita', escopo: 'individual' });
    expect(
      (
        await editar(l, l.titular, id, {
          valor_total_centavos: 2_000,
          data: '2026-10-06',
          categoria_id: extra,
          descricao: 'x',
        })
      ).status,
    ).toBe(200);
    expect(await parcelasNoBanco(id)).toMatchObject([{ valor_centavos: 2_000, data: '2026-10-06' }]);
    expect(await pagamentoNoBanco(id)).toMatchObject({
      forma_pagamento_id: null,
      conta_id: l.ana.conta,
      data_operacao: '2026-10-06',
    });
    expect(await codigo(await editar(l, l.titular, id, { forma_id: l.ana.pix }))).toBe('registro_invalido');
    expect(await codigo(await editar(l, l.titular, id, { categoria_id: l.ana.mercado }))).toBe('registro_invalido');
    // B nem enxerga a receita
    expect(await codigo(await editar(l, l.membro, id, { descricao: 'y' }))).toBe('registro_invalido');
  });

  it('ordem das recusas (RT-02): registro_invalido → sem_permissao → valor_invalido → categoria_arquivada → forma_arquivada → confirmar_descarte', async () => {
    const l = await larParaLancar('ed.ordem');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 3_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const velha = await criarCategoria(l.app, l.titular, { nome: 'Velha', tipo: 'despesa', escopo: 'conjunto' });
    await pedir(l.app, 'POST', `/api/categorias/${velha}/arquivar`, l.titular);
    const formaVelha = await criarForma(l.app, l.titular, { nome: 'Velho', tipo: 'credito', dia_vencimento: 3 });
    await pedir(l.app, 'POST', `/api/formas/${formaVelha}/arquivar`, l.titular);
    const p1 = (await parcelasNoBanco(id))[0]!;
    await pedir(l.app, 'PATCH', `/api/parcelas/${p1.id}`, l.titular, { data: '2026-11-11' });
    // B: categoria invisível (registro) vence sem_permissao e valor inválido
    expect(
      await codigo(
        await editar(l, l.membro, id, { categoria_id: l.ana.lazer, num_parcelas: 2, valor_total_centavos: 0 }),
      ),
    ).toBe('registro_invalido');
    // B: sem_permissao vence valor inválido
    expect(await codigo(await editar(l, l.membro, id, { num_parcelas: 2, valor_total_centavos: 0 }))).toBe(
      'sem_permissao',
    );
    // A: valor inválido vence categoria arquivada
    expect(await codigo(await editar(l, l.titular, id, { valor_total_centavos: 0, categoria_id: velha }))).toBe(
      'valor_invalido',
    );
    // A: categoria arquivada vence forma arquivada
    expect(await codigo(await editar(l, l.titular, id, { categoria_id: velha, forma_id: formaVelha }))).toBe(
      'categoria_arquivada',
    );
    // A: forma arquivada vence confirmar_descarte
    expect(await codigo(await editar(l, l.titular, id, { forma_id: formaVelha }))).toBe('forma_arquivada');
    expect(await codigo(await editar(l, l.titular, id, { valor_total_centavos: 9_000 }))).toBe(
      'confirmar_descarte_ajustes',
    );
    // forma do outro membro: registro_invalido
    expect(await codigo(await editar(l, l.titular, id, { forma_id: l.bruno.credito }))).toBe('registro_invalido');
  });

  it('id de outro lar, inexistente ou malformado → registro_invalido (mesma resposta)', async () => {
    const l = await larParaLancar('ed.alheio');
    const fora = await larParaLancar('ed.alheio.fora');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
    });
    const r1 = await editar(l, fora.titular, id, { descricao: 'x' });
    const r2 = await editar(l, fora.titular, novoId(), { descricao: 'x' });
    expect(await r1.text()).toBe(await r2.text());
    expect(r1.status).toBe(404);
    expect(await codigo(await editar(l, l.titular, 'abc', { descricao: 'x' }))).toBe('registro_invalido');
  });
});

describe.skipIf(!bancoDisponivel)('PATCH /api/parcelas/:id (CA-06.7)', () => {
  it('o pagador ajusta a data de uma parcela do Crédito: só ela muda, com data_ajustada, e passa a contar no mês da nova data', async () => {
    const l = await larParaLancar('par.ok');
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const [p1, p2, p3] = await parcelasNoBanco(id);
    const r = await pedir(l.app, 'PATCH', `/api/parcelas/${p2!.id}`, l.titular, { data: '2027-02-01' });
    expect(r.status).toBe(204);
    expect(await parcelasNoBanco(id)).toEqual([p1, { ...p2, data: '2027-02-01', data_ajustada: true }, p3]);
    const fev = await json<{ itens: { parcela_id: string }[] }>(
      await pedir(l.app, 'GET', '/api/lancamentos?mes=2027-02-01', l.titular),
    );
    expect(fev.itens.map((i) => i.parcela_id)).toEqual([p2!.id]);
    // repetir a data é aceito
    expect((await pedir(l.app, 'PATCH', `/api/parcelas/${p2!.id}`, l.titular, { data: '2027-02-01' })).status).toBe(
      204,
    );
    // o detalhe mostra o ajuste ao pagador
    const d = saida.LancamentoDoPagador.parse(await detalhe(l.app, l.titular, id));
    expect(d.parcelas.map((p) => p.data_ajustada)).toEqual([false, true, false]);
  });

  it('compra que não é Crédito, parcela de outro membro, de outro lar ou inexistente → registro_invalido (a mesma resposta)', async () => {
    const l = await larParaLancar('par.recusas');
    const fora = await larParaLancar('par.recusas.fora');
    const pix = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 300,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
    });
    const doBruno = await lancarDespesa(l.app, l.membro, {
      valor_centavos: 300,
      categoria_id: l.bruno.mercado,
      forma_id: l.bruno.credito,
      parcelas: 3,
    });
    const receita = await lancarReceita(l.app, l.titular, {
      valor_centavos: 10,
      categoria_id: l.ana.salario,
      conta_id: l.ana.conta,
    });
    const alvos = [
      (await parcelasNoBanco(pix))[0]!.id,
      (await parcelasNoBanco(doBruno))[0]!.id,
      (await parcelasNoBanco(receita))[0]!.id,
      novoId(),
    ];
    const textos = new Set<string>();
    for (const alvo of alvos) {
      const r = await pedir(l.app, 'PATCH', `/api/parcelas/${alvo}`, l.titular, { data: '2026-12-01' });
      expect(r.status).toBe(404);
      textos.add(await r.text());
    }
    const r = await pedir(l.app, 'PATCH', `/api/parcelas/${(await parcelasNoBanco(doBruno))[0]!.id}`, fora.titular, {
      data: '2026-12-01',
    });
    textos.add(await r.text());
    expect(textos.size).toBe(1);
    expect(await parcelasNoBanco(doBruno)).toMatchObject([
      { data_ajustada: false },
      { data_ajustada: false },
      { data_ajustada: false },
    ]);
  });

  it('data vazia ou nula → valor_invalido, ANTES de registro_invalido (mesmo com id inexistente ou malformado)', async () => {
    const l = await larParaLancar('par.vazia');
    for (const alvo of [novoId(), 'nao-e-uuid']) {
      for (const corpo of [{ data: null }, { data: '' }, {}]) {
        const r = await pedir(l.app, 'PATCH', `/api/parcelas/${alvo}`, l.titular, corpo);
        expect(r.status, `${alvo} ${JSON.stringify(corpo)}`).toBe(400);
        expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
      }
    }
  });
});

describe.skipIf(!bancoDisponivel)('DELETE /api/lancamentos/:id (CA-06.8)', () => {
  it('B exclui a conjunta de A: parcelas e parte privada somem juntas; o saldo de A volta', async () => {
    const l = await larParaLancar('exc.conjunta');
    const antes = (
      await json<{ id: string; saldo_centavos: number }[]>(await pedir(l.app, 'GET', '/api/contas', l.titular))
    ).find((c) => c.id === l.ana.conta)!.saldo_centavos;
    const id = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 700,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-01-01',
    });
    expect((await pedir(l.app, 'DELETE', `/api/lancamentos/${id}`, l.membro)).status).toBe(204);
    expect(await lancamentoNoBanco(id)).toBeNull();
    expect(await parcelasNoBanco(id)).toEqual([]);
    expect(await pagamentoNoBanco(id)).toBeNull();
    const depois = (
      await json<{ id: string; saldo_centavos: number }[]>(await pedir(l.app, 'GET', '/api/contas', l.titular))
    ).find((c) => c.id === l.ana.conta)!.saldo_centavos;
    expect(depois).toBe(antes);
    // de novo: já excluído
    expect(await codigo(await pedir(l.app, 'DELETE', `/api/lancamentos/${id}`, l.titular))).toBe('registro_invalido');
  });

  it('B não exclui o individual de A; outro lar não exclui nada (registro_invalido) e nada muda', async () => {
    const l = await larParaLancar('exc.alheio');
    const fora = await larParaLancar('exc.alheio.fora');
    const individual = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 100,
      categoria_id: l.ana.lazer,
      forma_id: l.ana.pix,
    });
    const conjunta = await lancarDespesa(l.app, l.titular, {
      valor_centavos: 100,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
    });
    expect(await codigo(await pedir(l.app, 'DELETE', `/api/lancamentos/${individual}`, l.membro))).toBe(
      'registro_invalido',
    );
    expect(await codigo(await pedir(l.app, 'DELETE', `/api/lancamentos/${conjunta}`, fora.titular))).toBe(
      'registro_invalido',
    );
    expect(await lancamentoNoBanco(individual)).not.toBeNull();
    expect(await lancamentoNoBanco(conjunta)).not.toBeNull();
  });
});

describe.skipIf(!bancoDisponivel)('saída do membro e lançamentos (CA-23.12, decisão L2 de 2026-10-25)', () => {
  it('saída voluntária: a parte privada dos pagamentos dele é apagada na hora; a conjunta fica com "Ex-membro" e o titular a edita (valor) e exclui', async () => {
    const l = await larParaLancar('saida.lanc');
    const conjunta = await lancarDespesa(l.app, l.membro, {
      valor_centavos: 3_000,
      categoria_id: l.bruno.mercado,
      forma_id: l.bruno.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const individual = await lancarDespesa(l.app, l.membro, {
      valor_centavos: 100,
      categoria_id: l.bruno.lazer,
      forma_id: l.bruno.pix,
    });
    expect((await pedir(l.app, 'POST', '/api/lar/sair', l.membro)).status).toBe(204);
    expect(await pagamentoNoBanco(conjunta)).toBeNull();
    expect(await pagamentoNoBanco(individual)).toBeNull();
    const d = saida.LancamentoDoOutroMembro.parse(await detalhe(l.app, l.titular, conjunta));
    expect(d.pagador).toMatchObject({ nome: 'Ex-membro', sou_eu: false });
    const r = await editar(l, l.titular, conjunta, { valor_total_centavos: 6_000 });
    expect(r.status).toBe(200);
    expect((await parcelasNoBanco(conjunta)).map((p) => [p.valor_centavos, p.data])).toEqual([
      [2_000, '2026-11-10'],
      [2_000, '2026-12-10'],
      [2_000, '2027-01-10'],
    ]);
    expect(await codigo(await editar(l, l.titular, conjunta, { data: '2026-10-01' }))).toBe('sem_permissao');
    expect((await pedir(l.app, 'DELETE', `/api/lancamentos/${conjunta}`, l.titular)).status).toBe(204);
  });

  it('SPEC_DEVIATION aceita (L2): na remoção pelo titular a parte privada do removido fica até a purga (etapa 14), invisível à API', async () => {
    const l = await larParaLancar('remocao.lanc');
    const conjunta = await lancarDespesa(l.app, l.membro, {
      valor_centavos: 500,
      categoria_id: l.bruno.mercado,
      forma_id: l.bruno.pix,
    });
    const membroId = await membroDe(l.membro);
    expect((await pedir(l.app, 'DELETE', `/api/lar/membros/${membroId}`, l.titular)).status).toBe(204);
    expect(await pagamentoNoBanco(conjunta)).not.toBeNull();
    const d = await detalhe(l.app, l.titular, conjunta);
    expect('pagamento' in d).toBe(false);
    expect(JSON.stringify(d)).not.toContain(l.bruno.pix);
  });

  it('decidirAceite: o titular sozinho com lançamento (e os cadastros que ele exige) recebe ja_tem_lar ao aceitar convite de outro lar', async () => {
    const l = await larParaLancar('aceite.lanc');
    const sozinho = await larParaLancar('aceite.lanc.sozinho');
    // o membro do lar "sozinho" sai, deixando o titular sem membro, mas com lançamento
    await lancarDespesa(sozinho.app, sozinho.titular, {
      valor_centavos: 1,
      categoria_id: sozinho.ana.mercado,
      forma_id: sozinho.ana.pix,
    });
    await pedir(sozinho.app, 'POST', '/api/lar/sair', sozinho.membro);
    await pedir(l.app, 'POST', '/api/lar/sair', l.membro);
    const c = await pedir(l.app, 'POST', '/api/lar/convites', l.titular, { email: sozinho.titular.email });
    expect(c.status).toBe(201);
    const token = l.caixa.ultimoToken(sozinho.titular.email);
    const r = await pedir(l.app, 'POST', '/api/convites/aceitar', sozinho.titular, { token });
    expect(await json(r)).toMatchObject({ code: 'ja_tem_lar' });
  });
});
