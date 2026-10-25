import { entrada } from '@controle/contrato';
import type { Hono } from 'hono';
import { alterarDataDaParcela, excluirLancamento } from '../../aplicacao/lancamentos/alterar';
import { dadosDoLancamentoRapido, detalheDoLancamento, lancamentosDoMes } from '../../aplicacao/lancamentos/consultar';
import { editarLancamento } from '../../aplicacao/lancamentos/editar';
import { lancarDespesa, lancarReceita } from '../../aplicacao/lancamentos/lancar';
import { registrarPagamentoCartao } from '../../aplicacao/lancamentos/pagamento-cartao';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import { emTransacao, exigirLar } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { depsDe, idDaRota } from './comum';

/**
 * Rotas de lançamento (SDD 6.1 #4, #15, #20 a #26; RN-01, RN-04 a RN-07, RN-12 a RN-14). Todas "A": autenticado
 * com lar (`exigirLar`, senão 409 `sem_lar`). O lar e o dono vêm do vínculo derivado no banco (G-03).
 * Escritas de criação respondem 201 quando criaram e 200 quando o id já era do membro, com `ja_existia` no corpo
 * (decisão do usuário de 2026-10-25; SDD 8.3). Os cadastros (etapa 7) respondem só `{ id }`.
 */
export function registrarRotasDeLancamentos(app: Hono<AppEnv>): void {
  // Antes de `/api/lancamentos/:id`: o caminho fixo não pode cair no parâmetro.
  app.get('/api/lancamentos/dados', emTransacao, exigirLar, async (c) =>
    c.json(await dadosDoLancamentoRapido(depsDe(c)), 200),
  );

  app.get('/api/lancamentos', emTransacao, exigirLar, async (c) => {
    const filtro = entrada.FiltroLancamentos.safeParse(c.req.query());
    if (!filtro.success) throw new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
    return c.json(await lancamentosDoMes(depsDe(c), filtro.data), 200);
  });

  app.post('/api/lancamentos/despesas', emTransacao, exigirLar, async (c) => {
    const dados = await lerCorpo(c, entrada.LancarDespesa);
    const r = await lancarDespesa(depsDe(c), dados);
    return c.json(r.corpo, r.criado ? 201 : 200);
  });

  app.post('/api/lancamentos/receitas', emTransacao, exigirLar, async (c) => {
    const dados = await lerCorpo(c, entrada.LancarReceita);
    const r = await lancarReceita(depsDe(c), dados);
    return c.json(r.corpo, r.criado ? 201 : 200);
  });

  app.get('/api/lancamentos/:id', emTransacao, exigirLar, async (c) =>
    c.json(await detalheDoLancamento(depsDe(c), idDaRota(c)), 200),
  );

  app.patch('/api/lancamentos/:id', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.EditarLancamento);
    return c.json(await editarLancamento(depsDe(c), id, dados), 200);
  });

  app.delete('/api/lancamentos/:id', emTransacao, exigirLar, async (c) => {
    await excluirLancamento(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  // Ordem herdada (A alterar_data_parcela.sql): a data vazia (`valor_invalido`) vem antes do id (`registro_invalido`).
  app.patch('/api/parcelas/:id', emTransacao, exigirLar, async (c) => {
    const dados = await lerCorpo(c, entrada.AlterarDataParcela);
    await alterarDataDaParcela(depsDe(c), idDaRota(c), dados);
    return c.body(null, 204);
  });

  // Pagamento de cartão (RN-13). O `valor_invalido` do corpo vem antes da idempotência (A registrar_pagamento_cartao.sql).
  app.post('/api/formas/:id/pagamentos', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.PagamentoCartao);
    const r = await registrarPagamentoCartao(depsDe(c), id, dados);
    return c.json(r.corpo, r.criado ? 201 : 200);
  });
}
