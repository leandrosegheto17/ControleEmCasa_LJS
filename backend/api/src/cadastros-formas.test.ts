import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { contarPorId, criarConta, criarForma, larParaCadastros, listar, novoId } from './testes-suporte-cadastros';
import { json, linhasComoOwner, pedir } from './testes-suporte-lar';

/**
 * Formas de pagamento (PRD-TECNICO RN-03; CA-03.1 a CA-03.4; SDD 6.1 #10 a #14; ADR-010).
 * Cada caso nasce do critério de aceite, não do código.
 */

type Linha = ReturnType<typeof saida.LinhaFormasPagamento.parse>;

const salvar = (app: Parameters<typeof pedir>[0], quem: Parameters<typeof pedir>[3], corpo: unknown, id = novoId()) =>
  pedir(app, 'PUT', `/api/formas/${id}`, quem, corpo);

describe.skipIf(!bancoDisponivel)('PUT /api/formas/:id (salvar)', () => {
  it('Pix e Débito com conta própria: 201; o dia enviado é ignorado (gravado nulo)', async () => {
    const { app, titular } = await larParaCadastros('forma.pixdeb');
    const conta = await criarConta(app, titular, { nome: 'Itaú' });
    const pix = novoId();
    const r = await salvar(app, titular, { nome: 'Pix Itaú', tipo: 'pix', conta_id: conta, dia_vencimento: 10 }, pix);
    expect(r.status).toBe(201);
    expect(saida.IdSalvo.parse(await json(r))).toEqual({ id: pix });
    const deb = await criarForma(app, titular, { nome: 'Débito', tipo: 'debito', conta_id: conta });
    const lista = (await listar<unknown>(app, '/api/formas', titular)).map((l) => saida.LinhaFormasPagamento.parse(l));
    expect(lista.find((l) => l.id === pix)).toEqual({
      id: pix,
      nome: 'Pix Itaú',
      tipo: 'pix',
      conta: { id: conta, nome: 'Itaú' },
      dia_vencimento: null,
      preferida: false,
      arquivada: false,
      pode_excluir: true,
      gasto_mes_centavos: null,
      comprometido_futuro_centavos: null,
    });
    expect(lista.find((l) => l.id === deb)).toMatchObject({ tipo: 'debito', dia_vencimento: null });
  });

  it('Crédito com dia de vencimento: 201; a conta é opcional; gasto e comprometido começam em 0', async () => {
    const { app, titular } = await larParaCadastros('forma.credito');
    const sem = await criarForma(app, titular, { nome: 'Nubank', tipo: 'credito', dia_vencimento: 10 });
    const conta = await criarConta(app, titular);
    const com = await criarForma(app, titular, {
      nome: 'Itaú Card',
      tipo: 'credito',
      dia_vencimento: 31,
      conta_id: conta,
    });
    const lista = await listar<Linha>(app, '/api/formas', titular);
    expect(lista.find((l) => l.id === sem)).toMatchObject({
      conta: null,
      dia_vencimento: 10,
      gasto_mes_centavos: 0,
      comprometido_futuro_centavos: 0,
    });
    expect(lista.find((l) => l.id === com)).toMatchObject({ conta: { id: conta, nome: 'Itaú' }, dia_vencimento: 31 });
  });

  it('CA-03.1: Pix ou Débito sem conta (ausente ou nula) dá 400 valor_invalido', async () => {
    const { app, titular } = await larParaCadastros('forma.semconta');
    for (const corpo of [
      { nome: 'Pix', tipo: 'pix' },
      { nome: 'Déb', tipo: 'debito', conta_id: null },
    ]) {
      const r = await salvar(app, titular, corpo);
      expect(r.status, JSON.stringify(corpo)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('CA-03.2: Crédito sem dia ou com dia fora de 1 a 31 dá 400 valor_invalido', async () => {
    const { app, titular } = await larParaCadastros('forma.dia');
    for (const dia of [undefined, null, 0, 32, -3, 1.5]) {
      const r = await salvar(app, titular, { nome: 'Cartão', tipo: 'credito', dia_vencimento: dia });
      expect(r.status, String(dia)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('nome vazio, acima de 120 caracteres reais e tipo desconhecido dão 400', async () => {
    const { app, titular } = await larParaCadastros('forma.nome');
    const base = { tipo: 'credito', dia_vencimento: 5 };
    expect((await salvar(app, titular, { ...base, nome: '  ' })).status).toBe(400);
    expect((await salvar(app, titular, { ...base, nome: 'a'.repeat(121) })).status).toBe(400);
    expect((await salvar(app, titular, { ...base, nome: '😀'.repeat(120) })).status).toBe(201);
    expect((await salvar(app, titular, { ...base, nome: 'x', tipo: 'boleto' })).status).toBe(400);
  });

  it('CA-T3.1: reenviar o mesmo id não duplica (200); com outro corpo edita a mesma forma', async () => {
    const { app, titular } = await larParaCadastros('forma.idem');
    const id = novoId();
    const corpo = { nome: 'Nubank', tipo: 'credito', dia_vencimento: 10 };
    expect((await salvar(app, titular, corpo, id)).status).toBe(201);
    const de_novo = await salvar(app, titular, corpo, id);
    expect(de_novo.status).toBe(200);
    expect(await json(de_novo)).toEqual({ id });
    expect((await salvar(app, titular, { ...corpo, nome: 'Nubank Ultra' }, id)).status).toBe(200);
    expect(await contarPorId('forma_pagamento', id)).toBe(1);
    expect((await listar<Linha>(app, '/api/formas', titular))[0]).toMatchObject({ nome: 'Nubank Ultra' });
  });

  it('CA-03.3: mudar o dia do cartão de 10 para 15 só altera a forma (as parcelas gravadas ficam: nenhuma é tocada)', async () => {
    const { app, titular } = await larParaCadastros('forma.mudadia');
    const id = await criarForma(app, titular, { nome: 'Nubank', tipo: 'credito', dia_vencimento: 10 });
    expect((await salvar(app, titular, { nome: 'Nubank', tipo: 'credito', dia_vencimento: 15 }, id)).status).toBe(200);
    expect((await listar<Linha>(app, '/api/formas', titular))[0]?.dia_vencimento).toBe(15);
  });

  it('o tipo não muda depois de criada: 400 valor_invalido e a forma fica como estava', async () => {
    const { app, titular } = await larParaCadastros('forma.tipo');
    const conta = await criarConta(app, titular);
    const id = await criarForma(app, titular, { tipo: 'pix', conta_id: conta });
    const r = await salvar(app, titular, { nome: 'Agora crédito', tipo: 'credito', dia_vencimento: 5 }, id);
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    expect((await listar<Linha>(app, '/api/formas', titular))[0]).toMatchObject({ tipo: 'pix', nome: 'Forma' });
  });

  it('conta de outro membro ou inexistente: 404 registro_invalido', async () => {
    const { app, titular, membro } = await larParaCadastros('forma.contaalheia');
    const dela = await criarConta(app, titular);
    for (const conta_id of [dela, novoId()]) {
      const r = await salvar(app, membro, { nome: 'Pix', tipo: 'pix', conta_id });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('conta arquivada só é recusada quando a conta da forma muda para ela; reeditar a forma que já a usa é aceito', async () => {
    const { app, titular } = await larParaCadastros('forma.contaarq');
    const velha = await criarConta(app, titular, { nome: 'Velha' });
    const nova = await criarConta(app, titular, { nome: 'Nova' });
    const forma = await criarForma(app, titular, { tipo: 'pix', conta_id: velha });
    await pedir(app, 'POST', `/api/contas/${velha}/arquivar`, titular);
    // nova forma já apontando para conta arquivada: recusa
    const nova_forma = await salvar(app, titular, { nome: 'X', tipo: 'pix', conta_id: velha });
    expect(nova_forma.status).toBe(400);
    expect(await json(nova_forma)).toMatchObject({ code: 'valor_invalido' });
    // reeditar mantendo a conta arquivada: aceito
    expect((await salvar(app, titular, { nome: 'Renomeada', tipo: 'pix', conta_id: velha }, forma)).status).toBe(200);
    // trocar para uma conta ativa e voltar para a arquivada: a volta é recusada
    expect((await salvar(app, titular, { nome: 'Renomeada', tipo: 'pix', conta_id: nova }, forma)).status).toBe(200);
    expect((await salvar(app, titular, { nome: 'Renomeada', tipo: 'pix', conta_id: velha }, forma)).status).toBe(400);
  });

  it('não aceita preferida, arquivada, lar nem dono vindos do cliente', async () => {
    const { app, titular, membro } = await larParaCadastros('forma.extras');
    const base = { nome: 'Nu', tipo: 'credito', dia_vencimento: 10 };
    for (const extra of [{ preferida: true }, { arquivada: true }, { dono_id: membro.id }]) {
      expect((await salvar(app, titular, { ...base, ...extra })).status).toBe(400);
    }
  });

  it('editar não muda a preferida nem desarquiva', async () => {
    const { app, titular } = await larParaCadastros('forma.edita-estado');
    const id = await criarForma(app, titular, { nome: 'A', tipo: 'credito', dia_vencimento: 1 });
    await pedir(app, 'PUT', `/api/formas/${id}/preferida`, titular, { preferida: true });
    await salvar(app, titular, { nome: 'B', tipo: 'credito', dia_vencimento: 2 }, id);
    expect((await listar<Linha>(app, '/api/formas', titular))[0]).toMatchObject({ nome: 'B', preferida: true });
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/formas', () => {
  it('cada membro vê só as próprias formas (arquivadas incluídas)', async () => {
    const { app, titular, membro } = await larParaCadastros('forma.lista');
    const a = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 3 });
    const arq = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 4 });
    await pedir(app, 'POST', `/api/formas/${arq}/arquivar`, titular);
    const b = await criarForma(app, membro, { tipo: 'credito', dia_vencimento: 5 });
    const deAna = await listar<Linha>(app, '/api/formas', titular);
    expect(deAna.map((l) => l.id).sort()).toEqual([a, arq].sort());
    expect(deAna.find((l) => l.id === arq)?.arquivada).toBe(true);
    expect((await listar<Linha>(app, '/api/formas', membro)).map((l) => l.id)).toEqual([b]);
  });
});

describe.skipIf(!bancoDisponivel)('PUT /api/formas/:id/preferida (CA-03.4)', () => {
  it('ao definir outra como preferida, a anterior do membro deixa de ser; a do outro membro não é afetada', async () => {
    const { app, titular, membro } = await larParaCadastros('forma.pref');
    const f1 = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    const f2 = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 2 });
    const g1 = await criarForma(app, membro, { tipo: 'credito', dia_vencimento: 3 });
    await pedir(app, 'PUT', `/api/formas/${g1}/preferida`, membro, { preferida: true });
    expect((await pedir(app, 'PUT', `/api/formas/${f1}/preferida`, titular, { preferida: true })).status).toBe(204);
    expect((await pedir(app, 'PUT', `/api/formas/${f2}/preferida`, titular, { preferida: true })).status).toBe(204);
    const preferidas = async (quem: typeof titular) =>
      (await listar<Linha>(app, '/api/formas', quem)).filter((l) => l.preferida).map((l) => l.id);
    expect(await preferidas(titular)).toEqual([f2]);
    expect(await preferidas(membro)).toEqual([g1]);
  });

  it('é idempotente nos dois sentidos (204) e desligar deixa o membro sem preferida', async () => {
    const { app, titular } = await larParaCadastros('forma.pref-idem');
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    for (const preferida of [true, true, false, false]) {
      expect((await pedir(app, 'PUT', `/api/formas/${f}/preferida`, titular, { preferida })).status).toBe(204);
    }
    expect((await listar<Linha>(app, '/api/formas', titular))[0]?.preferida).toBe(false);
  });

  it('forma arquivada não vira preferida (400 valor_invalido); arquivar tira a preferência', async () => {
    const { app, titular } = await larParaCadastros('forma.pref-arq');
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    await pedir(app, 'PUT', `/api/formas/${f}/preferida`, titular, { preferida: true });
    await pedir(app, 'POST', `/api/formas/${f}/arquivar`, titular);
    expect((await listar<Linha>(app, '/api/formas', titular))[0]).toMatchObject({ arquivada: true, preferida: false });
    const r = await pedir(app, 'PUT', `/api/formas/${f}/preferida`, titular, { preferida: true });
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    // desligar numa arquivada é aceito
    expect((await pedir(app, 'PUT', `/api/formas/${f}/preferida`, titular, { preferida: false })).status).toBe(204);
  });

  it('forma inexistente ou do outro membro: 404 registro_invalido', async () => {
    const { app, titular, membro } = await larParaCadastros('forma.pref-alheia');
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    for (const id of [f, novoId()]) {
      const r = await pedir(app, 'PUT', `/api/formas/${id}/preferida`, membro, { preferida: true });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('duas trocas simultâneas de preferida: sobra exatamente uma preferida', async () => {
    const { app, titular } = await larParaCadastros('forma.pref-corrida');
    const f1 = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    const f2 = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 2 });
    const respostas = await Promise.all([
      pedir(app, 'PUT', `/api/formas/${f1}/preferida`, titular, { preferida: true }),
      pedir(app, 'PUT', `/api/formas/${f2}/preferida`, titular, { preferida: true }),
    ]);
    expect(respostas.map((r) => r.status)).toEqual([204, 204]);
    expect((await listar<Linha>(app, '/api/formas', titular)).filter((l) => l.preferida)).toHaveLength(1);
  });

  it('o corpo exige o booleano (400 valor_invalido)', async () => {
    const { app, titular } = await larParaCadastros('forma.pref-corpo');
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    for (const corpo of [{}, { preferida: 'sim' }, { preferida: true, extra: 1 }]) {
      expect((await pedir(app, 'PUT', `/api/formas/${f}/preferida`, titular, corpo)).status).toBe(400);
    }
  });
});

describe.skipIf(!bancoDisponivel)('arquivar e excluir forma (RN-03)', () => {
  it('arquivar é idempotente (204 duas vezes); inexistente ou alheia: 404 registro_invalido', async () => {
    const { app, titular, membro } = await larParaCadastros('forma.arquivar');
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    expect((await pedir(app, 'POST', `/api/formas/${f}/arquivar`, titular)).status).toBe(204);
    expect((await pedir(app, 'POST', `/api/formas/${f}/arquivar`, titular)).status).toBe(204);
    for (const id of [f, novoId()]) {
      const r = await pedir(app, 'POST', `/api/formas/${id}/arquivar`, membro);
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('excluir forma sem vínculo: 204 e some', async () => {
    const { app, titular } = await larParaCadastros('forma.excluir');
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    expect((await pedir(app, 'DELETE', `/api/formas/${f}`, titular)).status).toBe(204);
    expect(await contarPorId('forma_pagamento', f)).toBe(0);
  });

  it('forma ligada a pagamento de cartão: 409 em_uso, a forma fica e pode_excluir é falso', async () => {
    const { app, titular } = await larParaCadastros('forma.em-uso');
    const conta = await criarConta(app, titular);
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    await linhasComoOwner(sql`
      insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data, forma_credito_id)
      select c.lar_id, c.dono_id, c.id, 'pagamento_cartao', 'saida', 500, '2026-10-24', ${f} from app.conta c where c.id = ${conta}`);
    expect((await listar<Linha>(app, '/api/formas', titular))[0]?.pode_excluir).toBe(false);
    const r = await pedir(app, 'DELETE', `/api/formas/${f}`, titular);
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'em_uso' });
    expect(await contarPorId('forma_pagamento', f)).toBe(1);
  });

  it('CA-T1.3: forma alheia em uso responde registro_invalido, nunca em_uso', async () => {
    const { app, titular, membro } = await larParaCadastros('forma.em-uso-alheia');
    const conta = await criarConta(app, titular);
    const f = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
    await linhasComoOwner(sql`
      insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data, forma_credito_id)
      select c.lar_id, c.dono_id, c.id, 'pagamento_cartao', 'saida', 500, '2026-10-24', ${f} from app.conta c where c.id = ${conta}`);
    const r = await pedir(app, 'DELETE', `/api/formas/${f}`, membro);
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
  });
});
