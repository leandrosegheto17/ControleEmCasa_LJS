import { entrada } from '@controle/contrato';
import type { Context, Hono } from 'hono';
import { confirmarExclusao, pedirExclusao, type DepsExclusao } from '../../aplicacao/conta/exclusao';
import { lerConfig, lerConfigAsaas } from '../../config';
import type { AppEnv } from '../../env';
import { ErroApi } from '../../erros';
import { criarClienteAsaas, type ClienteAsaas } from '../../infraestrutura/asaas';
import { criarEnviadorDeEmail, type TransporteEmail } from '../../infraestrutura/email';
import { importarChaveHmac, type ChaveHmac } from '../../infraestrutura/seguranca/hmac';
import { limparCookieSessao } from '../../infraestrutura/sessao/cookie';
import { transporteDoAmbiente } from '../../infraestrutura/transporte-email-ambiente';
import { ipDoCliente } from '../../middleware/limite';
import { lerCorpo } from '../corpo';
import { agendarDe } from './comum';

export interface OpcoesConta {
  /** Transporte de e-mail injetado (testes); sem ele, vale o do ambiente (Resend, console em local). */
  transporteEmail?: TransporteEmail;
  /** Cliente do Asaas injetado (testes). Sem ele, o REST real, criado só se houver assinatura a cancelar. */
  asaas?: ClienteAsaas;
}

const chaves = new Map<string, Promise<ChaveHmac>>();
function chaveHmacDe(base64url: string): Promise<ChaveHmac> {
  let chave = chaves.get(base64url);
  if (!chave) {
    chave = importarChaveHmac(base64url);
    chaves.set(base64url, chave);
  }
  return chave;
}

/**
 * Rotas da exclusão de conta (SDD 6.2 "Conta"; RN-26; ADR-013).
 * - `POST /api/conta/exclusao` (A0): `{senha}` → 202 sem corpo (link enviado) | 400 `credenciais_invalidas` |
 *   429 `muitas_tentativas` | 401 `sessao_expirada`. Não usa a transação da requisição: confere a senha como o entrar.
 * - `POST /api/conta/exclusao/confirmar` (P, LIMITE_PUBLICO): `{token}` → 204 (sessões revogadas, purga em 30 dias,
 *   cookie limpo) | 400 `link_expirado`.
 * - `POST /api/conta/exclusao/cancelar` do SDD NÃO existe: o PRD (D8, CA-26.6) manda não reativar a conta em exclusão.
 */
export function registrarRotasDeConta(app: Hono<AppEnv>, opcoes: OpcoesConta = {}): void {
  async function depsDe(c: Context<AppEnv>): Promise<DepsExclusao> {
    const env = c.env as unknown as Record<string, unknown>;
    const config = lerConfig(env);
    return {
      db: c.get('db'),
      agora: c.get('agora'),
      chaveHmac: await chaveHmacDe(config.chaveHmac),
      email: criarEnviadorDeEmail(opcoes.transporteEmail ?? transporteDoAmbiente(config)),
      urlPublica: config.urlPublica,
      agendar: agendarDe(c),
      asaas: () => {
        if (opcoes.asaas) return opcoes.asaas;
        const a = lerConfigAsaas(env);
        return criarClienteAsaas({ urlBase: a.apiUrl, chaveApi: a.apiKey });
      },
    };
  }

  app.post('/api/conta/exclusao', async (c) => {
    const sessao = c.get('sessao');
    if (!sessao) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
    const { senha } = await lerCorpo(c, entrada.PedirExclusao);
    await pedirExclusao(await depsDe(c), { sessao, senha, ip: ipDoCliente(c) });
    return c.body(null, 202);
  });

  app.post('/api/conta/exclusao/confirmar', async (c) => {
    const { token } = await lerCorpo(c, entrada.ConfirmarExclusao);
    await confirmarExclusao(await depsDe(c), token);
    // As sessões já foram revogadas no banco; o cookie deste navegador (se houver) também sai.
    limparCookieSessao(c);
    return c.body(null, 204);
  });
}
