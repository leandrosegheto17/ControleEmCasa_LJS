import { entrada } from '@controle/contrato';
import type { Context, Hono } from 'hono';
import {
  arquivarCategoria,
  excluirCategoria,
  listarCategorias,
  salvarCategoria,
} from '../../aplicacao/cadastros/categorias';
import type { ResultadoSalvar } from '../../aplicacao/cadastros/comum';
import { ajustarSaldo, arquivarConta, excluirConta, listarContas, salvarConta } from '../../aplicacao/cadastros/contas';
import {
  arquivarForma,
  definirPreferida,
  excluirForma,
  listarFormas,
  salvarForma,
} from '../../aplicacao/cadastros/formas';
import type { AppEnv } from '../../env';
import { emTransacao, exigirLar } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { depsDe, idDaRota } from './comum';

/** Escrita idempotente pelo id do cliente (ADR-010): 201 quando criou, 200 quando o id já era do membro. */
const respostaDeSalvar = (c: Context<AppEnv>, r: ResultadoSalvar) => c.json({ id: r.id }, r.criado ? 201 : 200);

/**
 * Rotas de contas, formas de pagamento e categorias (SDD 6.1 #5 a #19; RN-03, RN-12, RN-17). Todas "A":
 * autenticado com lar (`exigirLar`, senão 409 `sem_lar`). O lar e o dono vêm do vínculo derivado no banco
 * (G-03); nenhum corpo os aceita. O id da rota malformado vale como inexistente (RT-01), antes do corpo (RT-02).
 */
export function registrarRotasDeCadastros(app: Hono<AppEnv>): void {
  // Contas
  app.get('/api/contas', emTransacao, exigirLar, async (c) => c.json(await listarContas(depsDe(c)), 200));

  app.put('/api/contas/:id', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.SalvarConta);
    return respostaDeSalvar(c, await salvarConta(depsDe(c), id, dados));
  });

  app.post('/api/contas/:id/ajuste', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.AjustarSaldo);
    return c.json(await ajustarSaldo(depsDe(c), id, dados), 200);
  });

  app.post('/api/contas/:id/arquivar', emTransacao, exigirLar, async (c) => {
    await arquivarConta(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  app.delete('/api/contas/:id', emTransacao, exigirLar, async (c) => {
    await excluirConta(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  // Formas de pagamento
  app.get('/api/formas', emTransacao, exigirLar, async (c) => c.json(await listarFormas(depsDe(c)), 200));

  app.put('/api/formas/:id', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.SalvarForma);
    return respostaDeSalvar(c, await salvarForma(depsDe(c), id, dados));
  });

  app.put('/api/formas/:id/preferida', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.DefinirPreferida);
    await definirPreferida(depsDe(c), id, dados);
    return c.body(null, 204);
  });

  app.post('/api/formas/:id/arquivar', emTransacao, exigirLar, async (c) => {
    await arquivarForma(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  app.delete('/api/formas/:id', emTransacao, exigirLar, async (c) => {
    await excluirForma(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  // Categorias
  app.get('/api/categorias', emTransacao, exigirLar, async (c) => c.json(await listarCategorias(depsDe(c)), 200));

  app.put('/api/categorias/:id', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.SalvarCategoria);
    return respostaDeSalvar(c, await salvarCategoria(depsDe(c), id, dados));
  });

  app.post('/api/categorias/:id/arquivar', emTransacao, exigirLar, async (c) => {
    await arquivarCategoria(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  app.delete('/api/categorias/:id', emTransacao, exigirLar, async (c) => {
    await excluirCategoria(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });
}
