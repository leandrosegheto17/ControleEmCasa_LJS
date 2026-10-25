import { DataCalendario, entrada } from '@controle/contrato';
import type { Hono } from 'hono';
import {
  listarLocais,
  listarMetas,
  detalheDaMeta,
  listarMovimentos,
  movimentarMeta,
  salvarMeta,
} from '../../aplicacao/metas/metas';
import { copiarOrcamento, definirOrcamento, obterOrcamentoMes } from '../../aplicacao/orcamento/orcamento';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import { emTransacao, exigirLar } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { depsDe, idDaRota } from './comum';

/**
 * Rotas do orçamento e das metas (SDD 6.1 #34 a #41; RN-08, RN-09, RN-16; RN-25 entra na etapa 13). Todas "A":
 * autenticado com lar (`exigirLar`, senão 409 `sem_lar`). O lar e o autor vêm do vínculo derivado no banco (G-03).
 * O id da rota malformado vale como inexistente (RT-01), antes do mês e do corpo (RT-02). Tudo aberto por enquanto:
 * o `exigePlano('pro')` nas escritas (`PUT`/`POST`) entra na etapa 13.
 */

/** O mês da rota: data de calendário real (qualquer dia); fora disso, `valor_invalido`. */
function mesDaRota(valor: string | undefined): string {
  const r = DataCalendario.safeParse(valor);
  if (!r.success) throw new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
  return r.data;
}

export function registrarRotasDeOrcamentoEMetas(app: Hono<AppEnv>): void {
  app.get('/api/orcamento', emTransacao, exigirLar, async (c) => {
    const filtro = entrada.FiltroOrcamento.safeParse(c.req.query());
    if (!filtro.success) throw new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
    return c.json(await obterOrcamentoMes(depsDe(c), filtro.data.mes, filtro.data.escopo), 200);
  });

  app.put('/api/orcamento/:mes/:categoria_id', emTransacao, exigirLar, async (c) => {
    const categoriaId = idDaRota(c, 'categoria_id');
    const mes = mesDaRota(c.req.param('mes'));
    const dados = await lerCorpo(c, entrada.DefinirOrcamento);
    await definirOrcamento(depsDe(c), { mes, categoriaId, valorCentavos: dados.valor_centavos });
    return c.body(null, 204);
  });

  app.post('/api/orcamento/:mes/copiar', emTransacao, exigirLar, async (c) => {
    const mes = mesDaRota(c.req.param('mes'));
    const dados = await lerCorpo(c, entrada.CopiarOrcamento);
    return c.json(await copiarOrcamento(depsDe(c), { mes, escopo: dados.escopo }), 200);
  });

  app.get('/api/metas', emTransacao, exigirLar, async (c) => c.json(await listarMetas(depsDe(c)), 200));

  // Antes de `/api/metas/:id`: o caminho fixo não pode cair no parâmetro.
  app.get('/api/metas/locais', emTransacao, exigirLar, async (c) => c.json(await listarLocais(depsDe(c)), 200));

  app.get('/api/metas/:id', emTransacao, exigirLar, async (c) =>
    c.json(await detalheDaMeta(depsDe(c), idDaRota(c)), 200),
  );

  app.put('/api/metas/:id', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.SalvarMeta);
    const r = await salvarMeta(depsDe(c), id, dados);
    return c.json({ id: r.id }, r.criado ? 201 : 200);
  });

  app.post('/api/metas/:id/movimentos', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.MovimentarMeta);
    const r = await movimentarMeta(depsDe(c), id, dados);
    return c.json({ id: r.id }, r.criado ? 201 : 200);
  });

  app.get('/api/metas/:id/movimentos', emTransacao, exigirLar, async (c) =>
    c.json(await listarMovimentos(depsDe(c), idDaRota(c)), 200),
  );
}
