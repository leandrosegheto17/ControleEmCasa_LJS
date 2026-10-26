/**
 * MÓDULO ISOLADO do Asaas (SDD 2.2; decisão 4 do PLANO). Não importa nada do resto da API nem do banco: a fronteira
 * é garantida por regra do ESLint e por teste, para extrair o módulo depois para os outros apps.
 * Interface (SDD 2.2): `criarCliente`, `criarAssinatura`, `cancelarAssinatura`, `buscarPix`, `verificarWebhook`,
 * `lerEvento`; mais `buscarCobranca` e `listarCobrancasDaAssinatura`, porque o evento é só gatilho e a API consulta
 * o estado atual da cobrança (decisão do usuário, etapa 13).
 */
export { criarClienteAsaas, paraCentavos, paraReais, USER_AGENT_ASAAS, type OpcoesAsaas } from './cliente';
export { CABECALHO_TOKEN_WEBHOOK, lerDataAsaas, lerEvento, verificarWebhook } from './webhook';
export {
  ErroAsaas,
  type ClienteAsaas,
  type CobrancaAsaas,
  type EventoAsaas,
  type NovaAssinaturaAsaas,
  type NovoClienteAsaas,
  type PixAsaas,
} from './tipos';
