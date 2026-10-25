import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel, chamar, ORIGEM } from './testes-suporte';
import { relogioControlado } from './testes-suporte-acesso';
import {
  contarPorId,
  criarConta,
  criarForma,
  larParaCadastros,
  listar,
  movimentosDaConta,
  novoId,
} from './testes-suporte-cadastros';
import { appDeLar, criarLarDe, json, linhasComoOwner, pedir, pessoa } from './testes-suporte-lar';

/**
 * Contas (PRD-TECNICO RN-03, RN-12, RN-18; CA-03.5, CA-12.2, CA-12.3; SDD 6.1 #5 a #9; ADR-010).
 * Cada caso nasce do critério de aceite, não do código.
 */

type Linha = ReturnType<typeof saida.LinhaContas.parse>;

describe.skipIf(!bancoDisponivel)('PUT /api/contas/:id (salvar)', () => {
  it('cria a conta (201 { id }) e ela aparece na lista com o saldo inicial, sem lar nem dono', async () => {
    const { app, titular } = await larParaCadastros('conta.criar');
    const id = novoId();
    const r = await pedir(app, 'PUT', `/api/contas/${id}`, titular, {
      nome: '  Itaú  ',
      saldo_inicial_centavos: 12345,
    });
    expect(r.status).toBe(201);
    expect(saida.IdSalvo.parse(await json(r))).toEqual({ id });
    const lista = (await listar<unknown>(app, '/api/contas', titular)).map((l) => saida.LinhaContas.parse(l));
    expect(lista).toEqual([
      { id, nome: 'Itaú', saldo_inicial_centavos: 12345, saldo_centavos: 12345, arquivada: false, pode_excluir: true },
    ]);
  });

  it('saldo inicial ausente vale 0 e negativo é aceito (conta no vermelho)', async () => {
    const { app, titular } = await larParaCadastros('conta.saldo');
    const a = await criarConta(app, titular, { nome: 'Sem saldo' });
    const b = await criarConta(app, titular, { nome: 'No vermelho', saldo_inicial_centavos: -5000 });
    const lista = await listar<Linha>(app, '/api/contas', titular);
    expect(lista.find((l) => l.id === a)).toMatchObject({ saldo_inicial_centavos: 0, saldo_centavos: 0 });
    expect(lista.find((l) => l.id === b)).toMatchObject({ saldo_inicial_centavos: -5000, saldo_centavos: -5000 });
  });

  it('CA-T3.1: reenviar o mesmo id devolve { id } sem duplicar (200); com corpo novo, edita a mesma conta', async () => {
    const { app, titular } = await larParaCadastros('conta.idem');
    const id = novoId();
    expect((await pedir(app, 'PUT', `/api/contas/${id}`, titular, { nome: 'Nubank' })).status).toBe(201);
    const outra = await pedir(app, 'PUT', `/api/contas/${id}`, titular, { nome: 'Nubank' });
    expect(outra.status).toBe(200);
    expect(await json(outra)).toEqual({ id });
    const edita = await pedir(app, 'PUT', `/api/contas/${id}`, titular, {
      nome: 'Nubank PJ',
      saldo_inicial_centavos: 99,
    });
    expect(edita.status).toBe(200);
    expect(await contarPorId('conta', id)).toBe(1);
    const lista = await listar<Linha>(app, '/api/contas', titular);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nome: 'Nubank PJ', saldo_inicial_centavos: 99 });
  });

  it('editar não desarquiva a conta', async () => {
    const { app, titular } = await larParaCadastros('conta.arq-edit');
    const id = await criarConta(app, titular);
    await pedir(app, 'POST', `/api/contas/${id}/arquivar`, titular);
    await pedir(app, 'PUT', `/api/contas/${id}`, titular, { nome: 'Renomeada' });
    expect((await listar<Linha>(app, '/api/contas', titular))[0]).toMatchObject({ nome: 'Renomeada', arquivada: true });
  });

  it('CA-18.1: nome vazio, só espaços ou acima de 80 caracteres e saldo fora de ±10^11 dão 400 valor_invalido', async () => {
    const { app, titular } = await larParaCadastros('conta.invalida');
    for (const corpo of [
      { nome: '' },
      { nome: '   ' },
      { nome: 'a'.repeat(81) },
      { nome: 'x', saldo_inicial_centavos: 100_000_000_001 },
      { nome: 'x', saldo_inicial_centavos: -100_000_000_001 },
      { nome: 'x', saldo_inicial_centavos: 1.5 },
      {},
    ]) {
      const r = await pedir(app, 'PUT', `/api/contas/${novoId()}`, titular, corpo);
      expect(r.status, JSON.stringify(corpo)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('o teto de 80 conta caracteres reais: 80 emojis passam, 81 não', async () => {
    const { app, titular } = await larParaCadastros('conta.emoji');
    expect((await pedir(app, 'PUT', `/api/contas/${novoId()}`, titular, { nome: '😀'.repeat(80) })).status).toBe(201);
    expect((await pedir(app, 'PUT', `/api/contas/${novoId()}`, titular, { nome: '😀'.repeat(81) })).status).toBe(400);
  });

  it('o erro de validação não ecoa o valor recebido (SDD 7)', async () => {
    const { app, titular } = await larParaCadastros('conta.eco');
    const r = await pedir(app, 'PUT', `/api/contas/${novoId()}`, titular, {
      nome: 'ok',
      saldo_inicial_centavos: 'SEGREDO-123',
    });
    expect(r.status).toBe(400);
    expect(await r.text()).not.toContain('SEGREDO-123');
  });

  it('lar_id e dono_id vindos do cliente são recusados; o dono é sempre o membro da sessão', async () => {
    const { app, titular, membro, larId } = await larParaCadastros('conta.dono');
    const id = novoId();
    expect((await pedir(app, 'PUT', `/api/contas/${id}`, titular, { nome: 'x', dono_id: membro.id })).status).toBe(400);
    expect((await pedir(app, 'PUT', `/api/contas/${id}`, titular, { nome: 'x', lar_id: larId })).status).toBe(400);
    await criarConta(app, titular, { nome: 'Minha' }, id);
    const dono = await linhasComoOwner(
      sql<{
        usuario_id: string;
      }>`select m.usuario_id from app.conta c join app.membro m on m.id = c.dono_id where c.id = ${id}`,
    );
    expect(dono).toEqual([{ usuario_id: titular.id }]);
  });

  it('id de rota malformado vale como inexistente (404 registro_invalido); sem sessão 401; sem lar 409 sem_lar', async () => {
    const { app, titular } = await larParaCadastros('conta.rota');
    const ruim = await pedir(app, 'PUT', '/api/contas/nao-e-uuid', titular, { nome: 'x' });
    expect(ruim.status).toBe(404);
    expect(await json(ruim)).toMatchObject({ code: 'registro_invalido' });
    expect((await pedir(app, 'PUT', `/api/contas/${novoId()}`, null, { nome: 'x' })).status).toBe(401);
    const semLar = await pessoa('conta.semlar');
    const r = await pedir(app, 'GET', '/api/contas', semLar);
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'sem_lar' });
  });

  it('escrita sem o cabeçalho anti-CSRF é recusada (403 origem_invalida)', async () => {
    const { app, titular } = await larParaCadastros('conta.csrf');
    const r = await chamar(app, `/api/contas/${novoId()}`, {
      method: 'PUT',
      headers: { Cookie: titular.cookie, 'Content-Type': 'application/json', Origin: ORIGEM },
      body: JSON.stringify({ nome: 'x' }),
    });
    expect(r.status).toBe(403);
    expect(await json(r)).toMatchObject({ code: 'origem_invalida' });
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/contas', () => {
  it('lista só as contas do membro (arquivadas incluídas); o outro membro do lar não enxerga nenhuma', async () => {
    const { app, titular, membro } = await larParaCadastros('conta.lista');
    const a = await criarConta(app, titular, { nome: 'Da Ana' });
    const arq = await criarConta(app, titular, { nome: 'Antiga' });
    await pedir(app, 'POST', `/api/contas/${arq}/arquivar`, titular);
    const b = await criarConta(app, membro, { nome: 'Do Bruno' });
    const deAna = await listar<Linha>(app, '/api/contas', titular);
    expect(deAna.map((l) => l.id).sort()).toEqual([a, arq].sort());
    expect(deAna.find((l) => l.id === arq)?.arquivada).toBe(true);
    expect((await listar<Linha>(app, '/api/contas', membro)).map((l) => l.id)).toEqual([b]);
  });

  it('pode_excluir é falso com forma ou movimento ligados e verdadeiro sem vínculo', async () => {
    const { app, titular } = await larParaCadastros('conta.pode');
    const livre = await criarConta(app, titular, { nome: 'Livre' });
    const comForma = await criarConta(app, titular, { nome: 'ComForma' });
    await criarForma(app, titular, { tipo: 'pix', conta_id: comForma });
    const comAjuste = await criarConta(app, titular, { nome: 'ComAjuste' });
    await pedir(app, 'POST', `/api/contas/${comAjuste}/ajuste`, titular, { saldo_real_centavos: 100 });
    const lista = await listar<Linha>(app, '/api/contas', titular);
    const por = (id: string) => lista.find((l) => l.id === id)?.pode_excluir;
    expect([por(livre), por(comForma), por(comAjuste)]).toEqual([true, false, false]);
  });
});

describe.skipIf(!bancoDisponivel)('POST /api/contas/:id/ajuste (RN-12)', () => {
  it('CA-12.2: saldo real 1000 sobre 1250 grava saída de 250 na data de hoje e devolve −250', async () => {
    const r = relogioControlado(new Date('2026-10-24T15:00:00.000Z'));
    const { app, titular } = await larParaCadastros('ajuste.basico', { relogio: r.relogio, agora: r.agora() });
    const id = await criarConta(app, titular, { saldo_inicial_centavos: 1250 });
    const resp = await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: 1000 });
    expect(resp.status).toBe(200);
    expect(saida.Ajuste.parse(await json(resp))).toEqual({ diferenca_centavos: -250 });
    expect(await movimentosDaConta(id)).toEqual([
      { tipo: 'ajuste', sentido: 'saida', valor_centavos: '250', data: '2026-10-24' },
    ]);
    expect((await listar<Linha>(app, '/api/contas', titular))[0]).toMatchObject({
      saldo_inicial_centavos: 1250,
      saldo_centavos: 1000,
    });
  });

  it('diferença positiva grava entrada', async () => {
    const { app, titular } = await larParaCadastros('ajuste.entrada');
    const id = await criarConta(app, titular, { saldo_inicial_centavos: 1000 });
    const resp = await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: 1500 });
    expect(await json(resp)).toEqual({ diferenca_centavos: 500 });
    expect((await movimentosDaConta(id))[0]).toMatchObject({ sentido: 'entrada', valor_centavos: '500' });
  });

  it('CA-12.3: reenviar o mesmo saldo real devolve 0 e não grava de novo', async () => {
    const { app, titular } = await larParaCadastros('ajuste.idem');
    const id = await criarConta(app, titular, { saldo_inicial_centavos: 1250 });
    await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: 1000 });
    const de_novo = await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: 1000 });
    expect(await json(de_novo)).toEqual({ diferenca_centavos: 0 });
    expect(await movimentosDaConta(id)).toHaveLength(1);
  });

  it('simular só devolve a diferença: nada é gravado e o saldo não muda', async () => {
    const { app, titular } = await larParaCadastros('ajuste.simular');
    const id = await criarConta(app, titular, { saldo_inicial_centavos: 1250 });
    const resp = await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, {
      saldo_real_centavos: 1000,
      simular: true,
    });
    expect(await json(resp)).toEqual({ diferenca_centavos: -250 });
    expect(await movimentosDaConta(id)).toEqual([]);
    expect((await listar<Linha>(app, '/api/contas', titular))[0]?.saldo_centavos).toBe(1250);
  });

  it('saldo real negativo é aceito; conta arquivada pode ser ajustada', async () => {
    const { app, titular } = await larParaCadastros('ajuste.neg');
    const id = await criarConta(app, titular, { saldo_inicial_centavos: 200 });
    await pedir(app, 'POST', `/api/contas/${id}/arquivar`, titular);
    const resp = await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: -300 });
    expect(resp.status).toBe(200);
    expect(await json(resp)).toEqual({ diferenca_centavos: -500 });
    expect((await listar<Linha>(app, '/api/contas', titular))[0]?.saldo_centavos).toBe(-300);
  });

  it('CA-12.1 (movimento futuro): o movimento de hoje entra no saldo; o de amanhã não', async () => {
    const r = relogioControlado(new Date('2026-10-24T15:00:00.000Z'));
    const { app, titular } = await larParaCadastros('ajuste.futuro', { relogio: r.relogio, agora: r.agora() });
    const id = await criarConta(app, titular, { saldo_inicial_centavos: 1000 });
    const inserir = (data: string, valor: number) =>
      linhasComoOwner(sql`
        insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data)
        select c.lar_id, c.dono_id, c.id, 'ajuste', 'saida', ${valor}, ${data}::date from app.conta c where c.id = ${id}`);
    await inserir('2026-10-25', 400);
    expect((await listar<Linha>(app, '/api/contas', titular))[0]?.saldo_centavos).toBe(1000);
    await inserir('2026-10-24', 100);
    expect((await listar<Linha>(app, '/api/contas', titular))[0]?.saldo_centavos).toBe(900);
  });

  it('CA-T4.1: às 23:30 de 31/10 em São Paulo (02:30 de 01/11 em UTC) o ajuste é de 31/10', async () => {
    const r = relogioControlado(new Date('2026-11-01T02:30:00.000Z'));
    const { app, titular } = await larParaCadastros('ajuste.fuso', { relogio: r.relogio, agora: r.agora() });
    const id = await criarConta(app, titular);
    await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: 700 });
    expect((await movimentosDaConta(id))[0]?.data).toBe('2026-10-31');
  });

  it('saldo real ausente, fracionário ou texto: 400 valor_invalido', async () => {
    const { app, titular } = await larParaCadastros('ajuste.invalido');
    const id = await criarConta(app, titular);
    for (const corpo of [
      {},
      { saldo_real_centavos: 1.5 },
      { saldo_real_centavos: '10' },
      { saldo_real_centavos: null },
    ]) {
      const resp = await pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, corpo);
      expect(resp.status, JSON.stringify(corpo)).toBe(400);
      expect(await json(resp)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('conta inexistente ou do outro membro: registro_invalido, antes de qualquer cálculo, também na simulação', async () => {
    const { app, titular, membro } = await larParaCadastros('ajuste.alheia');
    const id = await criarConta(app, titular);
    for (const simular of [false, true]) {
      const resp = await pedir(app, 'POST', `/api/contas/${id}/ajuste`, membro, { saldo_real_centavos: 1, simular });
      expect(resp.status).toBe(404);
      expect(await json(resp)).toMatchObject({ code: 'registro_invalido' });
    }
    expect(await movimentosDaConta(id)).toEqual([]);
  });

  it('dois ajustes simultâneos da mesma conta se serializam: o segundo vê o saldo do primeiro', async () => {
    const { app, titular } = await larParaCadastros('ajuste.corrida');
    const id = await criarConta(app, titular, { saldo_inicial_centavos: 0 });
    const [a, b] = await Promise.all([
      pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: 500 }),
      pedir(app, 'POST', `/api/contas/${id}/ajuste`, titular, { saldo_real_centavos: 500 }),
    ]);
    const diferencas = [
      (await json<{ diferenca_centavos: number }>(a)).diferenca_centavos,
      (await json<{ diferenca_centavos: number }>(b)).diferenca_centavos,
    ];
    expect(diferencas.sort()).toEqual([0, 500]);
    expect(await movimentosDaConta(id)).toHaveLength(1);
  });
});

describe.skipIf(!bancoDisponivel)('arquivar e excluir conta (RN-03)', () => {
  it('arquivar é idempotente (204 duas vezes) e só muda o estado', async () => {
    const { app, titular } = await larParaCadastros('conta.arquivar');
    const id = await criarConta(app, titular, { nome: 'Antiga', saldo_inicial_centavos: 300 });
    expect((await pedir(app, 'POST', `/api/contas/${id}/arquivar`, titular)).status).toBe(204);
    expect((await pedir(app, 'POST', `/api/contas/${id}/arquivar`, titular)).status).toBe(204);
    expect((await listar<Linha>(app, '/api/contas', titular))[0]).toMatchObject({
      nome: 'Antiga',
      saldo_centavos: 300,
      arquivada: true,
    });
  });

  it('arquivar conta inexistente ou do outro membro: 404 registro_invalido', async () => {
    const { app, titular, membro } = await larParaCadastros('conta.arq-alheia');
    const id = await criarConta(app, titular);
    for (const alvo of [id, novoId()]) {
      const r = await pedir(app, 'POST', `/api/contas/${alvo}/arquivar`, membro);
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('excluir conta sem vínculo: 204 e some', async () => {
    const { app, titular } = await larParaCadastros('conta.excluir');
    const id = await criarConta(app, titular);
    expect((await pedir(app, 'DELETE', `/api/contas/${id}`, titular)).status).toBe(204);
    expect(await contarPorId('conta', id)).toBe(0);
    expect((await pedir(app, 'DELETE', `/api/contas/${id}`, titular)).status).toBe(404);
  });

  it('CA-03.5: conta com forma ligada ou com ajuste: 409 em_uso e a conta fica', async () => {
    const { app, titular } = await larParaCadastros('conta.em-uso');
    const comForma = await criarConta(app, titular, { nome: 'ComForma' });
    await criarForma(app, titular, { tipo: 'debito', conta_id: comForma });
    const comAjuste = await criarConta(app, titular, { nome: 'ComAjuste' });
    await pedir(app, 'POST', `/api/contas/${comAjuste}/ajuste`, titular, { saldo_real_centavos: 10 });
    for (const id of [comForma, comAjuste]) {
      const r = await pedir(app, 'DELETE', `/api/contas/${id}`, titular);
      expect(r.status).toBe(409);
      expect(await json(r)).toMatchObject({ code: 'em_uso' });
      expect(await contarPorId('conta', id)).toBe(1);
    }
  });

  it('CA-T1.3: conta alheia que estaria em uso responde registro_invalido, nunca em_uso', async () => {
    const { app, titular, membro } = await larParaCadastros('conta.em-uso-alheia');
    const id = await criarConta(app, titular);
    await criarForma(app, titular, { tipo: 'pix', conta_id: id });
    const r = await pedir(app, 'DELETE', `/api/contas/${id}`, membro);
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
  });
});

describe.skipIf(!bancoDisponivel)('contas entre lares (R3)', () => {
  it('o mesmo id de conta em outro lar não revela nem altera a conta do primeiro: 404 registro_invalido', async () => {
    const { app } = appDeLar();
    const ana = await pessoa('conta.lar.a');
    const bia = await pessoa('conta.lar.b');
    await criarLarDe(app, ana);
    await criarLarDe(app, bia);
    const id = await criarConta(app, ana, { nome: 'Da Ana', saldo_inicial_centavos: 777 });
    const r = await pedir(app, 'PUT', `/api/contas/${id}`, bia, { nome: 'Invadida', saldo_inicial_centavos: 1 });
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    expect((await listar<Linha>(app, '/api/contas', ana))[0]).toMatchObject({
      nome: 'Da Ana',
      saldo_inicial_centavos: 777,
    });
    expect(await listar<Linha>(app, '/api/contas', bia)).toEqual([]);
  });
});
