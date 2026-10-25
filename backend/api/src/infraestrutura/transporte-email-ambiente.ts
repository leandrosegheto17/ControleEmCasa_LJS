import type { Config } from '../config';
import { exibirLinkLocal } from '../log';
import { criarTransporteResend, type TransporteEmail } from './email';

/**
 * Escolhe o transporte de e-mail pelo ambiente (SDD 11.2):
 * - com `RESEND_API_KEY` (e fora de `teste`): Resend via `fetch`;
 * - `local` sem chave: console, só com o assunto e os links (nunca o destinatário);
 * - `teste` sem transporte injetado: descarta (nunca chama o Resend nem escreve no console).
 * Em `producao` a chave é obrigatória (a config falha fechada antes de chegar aqui).
 */
export function transporteDoAmbiente(config: Config): TransporteEmail {
  if (config.ambiente === 'teste') return async () => ({ ok: true });
  if (config.resendApiKey) {
    return criarTransporteResend({ chaveApi: config.resendApiKey, remetente: config.remetente });
  }
  if (config.ambiente === 'local') {
    return async (mensagem) => {
      exibirLinkLocal(mensagem.assunto, mensagem.texto.match(/https?:\/\/\S+/g) ?? []);
      return { ok: true };
    };
  }
  throw new Error('transporte_email_ausente');
}
