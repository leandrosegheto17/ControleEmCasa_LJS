/**
 * MÓDULO ISOLADO de e-mail (SDD 2.2; decisão 4 do PLANO). Não importa nada do resto da API nem do banco:
 * a fronteira é garantida por regra do ESLint e por teste, para extrair o módulo depois para os outros apps.
 * Interface: `criarEnviadorDeEmail(transporte).enviarEmail({ para, modelo, dados })`.
 */
import { montarConteudo, type DadosPorModelo, type ModeloEmail } from './modelos';
import type { ResultadoEnvio, TransporteEmail } from './tipos';

export { criarTransporteResend, URL_RESEND, type OpcoesResend } from './resend';
export { escaparHtml, montarConteudo, type DadosPorModelo, type ModeloEmail } from './modelos';
export type { MensagemEmail, ResultadoEnvio, TransporteEmail } from './tipos';

export interface PedidoEmail<M extends ModeloEmail> {
  para: string;
  modelo: M;
  dados: DadosPorModelo[M];
}

export interface EnviadorDeEmail {
  enviarEmail<M extends ModeloEmail>(pedido: PedidoEmail<M>): Promise<ResultadoEnvio>;
}

export function criarEnviadorDeEmail(transporte: TransporteEmail): EnviadorDeEmail {
  return {
    enviarEmail: (pedido) => transporte({ para: pedido.para, ...montarConteudo(pedido.modelo, pedido.dados) }),
  };
}
