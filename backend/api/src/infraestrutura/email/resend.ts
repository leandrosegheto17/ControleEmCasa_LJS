import type { MensagemEmail, ResultadoEnvio, TransporteEmail } from './tipos';

/** Endpoint de envio do Resend (sem SDK; SDD 1, decisão 4 do PLANO). */
export const URL_RESEND = 'https://api.resend.com/emails';

export interface OpcoesResend {
  /** `RESEND_API_KEY` (só envio, restrita ao domínio; G-34). */
  chaveApi: string;
  /** `MAIL_FROM`, no formato `Nome <email>`. */
  remetente: string;
  /** Injetável nos testes; por padrão o `fetch` global do Worker. */
  fetch?: typeof fetch;
}

/**
 * Transporte Resend via `fetch`. Nunca lança: devolve o resultado para o chamador registrar sem dado pessoal.
 * O corpo da resposta do Resend não é lido nem repassado (pode ecoar o destinatário).
 */
export function criarTransporteResend(opcoes: OpcoesResend): TransporteEmail {
  const enviar = opcoes.fetch ?? ((entrada, init) => fetch(entrada, init));
  return async (mensagem: MensagemEmail): Promise<ResultadoEnvio> => {
    try {
      const resposta = await enviar(URL_RESEND, {
        method: 'POST',
        headers: { Authorization: `Bearer ${opcoes.chaveApi}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: opcoes.remetente,
          to: [mensagem.para],
          subject: mensagem.assunto,
          text: mensagem.texto,
          html: mensagem.html,
        }),
      });
      await resposta.body?.cancel();
      return resposta.ok ? { ok: true } : { ok: false, motivo: 'http', status: resposta.status };
    } catch {
      return { ok: false, motivo: 'rede' };
    }
  };
}
