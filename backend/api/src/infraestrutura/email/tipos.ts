/** Mensagem pronta para o transporte. `para` é dado pessoal: o módulo nunca o registra. */
export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

/** Resultado sem dado pessoal: o chamador pode registrar `motivo` e `status`. */
export type ResultadoEnvio = { ok: true } | { ok: false; motivo: 'http' | 'rede'; status?: number };

export type TransporteEmail = (mensagem: MensagemEmail) => Promise<ResultadoEnvio>;
