import { entrada } from '@controle/contrato';
import type { Hono } from 'hono';
import { encerrarFixa, listarFixas, salvarFixa } from '../../aplicacao/fixas/fixas';
import { desfazerPagamento, ocorrenciasDoMesComGarantia, pagarOcorrencia } from '../../aplicacao/fixas/ocorrencias';
import { resumoDoMes } from '../../aplicacao/resumo/resumo';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import { emTransacao, exigirLar } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { depsDe, idDaRota } from './comum';

/**
 * Rotas das despesas fixas, das ocorrências e do resumo do mês (SDD 6.1 #27 a #33; RN-12, RN-13, RN-15, RN-16,
 * RN-28). Todas "A": autenticado com lar (`exigirLar`, senão 409 `sem_lar`). O lar e o pagador vêm do vínculo
 * derivado no banco (G-03). As leituras de mês gravam as ocorrências sob demanda (janela de ±12 meses), dentro da
 * transação da requisição. O id da rota malformado vale como inexistente (RT-01), antes do corpo (RT-02).
 */
export function registrarRotasDeFixas(app: Hono<AppEnv>): void {
  app.get('/api/fixas', emTransacao, exigirLar, async (c) => c.json(await listarFixas(depsDe(c)), 200));

  // Antes de `/api/fixas/:id/...`: o caminho fixo não pode cair no parâmetro.
  app.get('/api/fixas/ocorrencias', emTransacao, exigirLar, async (c) => {
    const filtro = entrada.FiltroOcorrencias.safeParse(c.req.query());
    if (!filtro.success) throw new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
    return c.json(await ocorrenciasDoMesComGarantia(depsDe(c), filtro.data.mes), 200);
  });

  app.put('/api/fixas/:id', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.SalvarFixa);
    const r = await salvarFixa(depsDe(c), id, dados);
    return c.json({ id: r.id }, r.criado ? 201 : 200);
  });

  app.post('/api/fixas/:id/encerrar', emTransacao, exigirLar, async (c) => {
    await encerrarFixa(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  app.post('/api/ocorrencias/:id/pagamento', emTransacao, exigirLar, async (c) => {
    const id = idDaRota(c);
    const dados = await lerCorpo(c, entrada.PagarOcorrencia);
    const r = await pagarOcorrencia(depsDe(c), id, dados);
    return c.json(r.corpo, r.criado ? 201 : 200);
  });

  app.delete('/api/ocorrencias/:id/pagamento', emTransacao, exigirLar, async (c) => {
    await desfazerPagamento(depsDe(c), idDaRota(c));
    return c.body(null, 204);
  });

  app.get('/api/resumo', emTransacao, exigirLar, async (c) => {
    const filtro = entrada.FiltroResumo.safeParse(c.req.query());
    if (!filtro.success) throw new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
    return c.json(await resumoDoMes(depsDe(c), filtro.data.mes), 200);
  });
}
