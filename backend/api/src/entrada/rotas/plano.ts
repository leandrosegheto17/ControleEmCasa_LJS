import { entrada } from '@controle/contrato';
import type { Context, Hono } from 'hono';
import { erroRegistroInvalido } from '../../aplicacao/lar/comum';
import type { DepsPlano } from '../../aplicacao/plano/comum';
import { assinar, cancelar, obterPlano } from '../../aplicacao/plano/plano';
import { processarWebhook } from '../../aplicacao/plano/webhook';
import { lerConfig, lerConfigAsaas } from '../../config';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import { criarClienteAsaas, lerEvento, verificarWebhook, type ClienteAsaas } from '../../infraestrutura/asaas';
import { criarEnviadorDeEmail, type TransporteEmail } from '../../infraestrutura/email';
import { transporteDoAmbiente } from '../../infraestrutura/transporte-email-ambiente';
import { emTransacao, exigirLar } from '../../middleware/transacao';
import { lerCorpo } from '../corpo';
import { agendarDe, depsDe } from './comum';

export interface OpcoesPlano {
  /** Transporte de e-mail injetado (testes). */
  transporteEmail?: TransporteEmail;
  /** Cliente do Asaas injetado (testes: um falso; nenhuma chamada sai). Sem ele, o REST real com a config. */
  asaas?: ClienteAsaas;
}

/**
 * Rotas do plano e o webhook do Asaas (SDD 6.2 "Plano" e "Webhook"; RN-24; G-28 a G-31).
 * - `GET /api/plano` (A): os dois membros; o convidado não vê dados de cobrança.
 * - `POST /api/plano/assinar` e `POST /api/plano/cancelar` (A, titular): o convidado recebe `registro_invalido`
 *   antes de o corpo ser lido (CA-24.6; RT-02).
 * - `POST /api/webhooks/asaas`: fora da sessão e do CSRF, sob `LIMITE_WEBHOOK`; o token é conferido em tempo
 *   constante ANTES de tocar o banco (TM-ASA-04); 401 `token_invalido` sem detalhe; 200 também no repetido e no
 *   ignorado.
 */
export function registrarRotasDePlano(app: Hono<AppEnv>, opcoes: OpcoesPlano = {}): void {
  const env = (c: Context<AppEnv>) => c.env as unknown as Record<string, unknown>;

  function asaasDe(c: Context<AppEnv>): ClienteAsaas {
    if (opcoes.asaas) return opcoes.asaas;
    const config = lerConfigAsaas(env(c));
    return criarClienteAsaas({ urlBase: config.apiUrl, chaveApi: config.apiKey });
  }

  function depsPlanoDe(c: Context<AppEnv>): DepsPlano {
    return { ...depsDe(c), asaas: asaasDe(c) };
  }

  function exigirTitular(deps: DepsPlano): void {
    if (deps.vinculo?.papel !== 'titular') throw erroRegistroInvalido();
  }

  app.get('/api/plano', emTransacao, exigirLar, async (c) => c.json(await obterPlano(depsPlanoDe(c)), 200));

  app.post('/api/plano/assinar', emTransacao, exigirLar, async (c) => {
    const deps = depsPlanoDe(c);
    exigirTitular(deps);
    const { cpf_cnpj } = await lerCorpo(c, entrada.Assinar);
    return c.json(await assinar(deps, cpf_cnpj), 201);
  });

  app.post('/api/plano/cancelar', emTransacao, exigirLar, async (c) => {
    const deps = depsPlanoDe(c);
    exigirTitular(deps);
    await cancelar(deps);
    return c.body(null, 204);
  });

  app.post('/api/webhooks/asaas', async (c) => {
    const config = lerConfigAsaas(env(c));
    if (!(await verificarWebhook(c.req.raw, config.webhookToken))) {
      throw new ErroApi(401, 'token_invalido', 'Não autorizado.');
    }
    let corpo: unknown;
    try {
      corpo = await c.req.json();
    } catch {
      throw new ErroApi(400, 'valor_invalido', 'Corpo da requisição inválido.');
    }
    const evento = lerEvento(corpo);
    if (!evento) throw new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
    const configGeral = lerConfig(env(c));
    const resultado = await processarWebhook(
      {
        db: c.get('db'),
        asaas: asaasDe(c),
        agora: c.get('agora'),
        email: criarEnviadorDeEmail(opcoes.transporteEmail ?? transporteDoAmbiente(configGeral)),
        urlPublica: configGeral.urlPublica,
        agendar: agendarDe(c),
      },
      evento,
    );
    return c.json({ ok: true, resultado }, 200);
  });
}
