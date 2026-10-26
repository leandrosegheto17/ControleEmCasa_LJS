/** Tipos do módulo isolado do Asaas. Nada aqui leva CPF/CNPJ, nome ou e-mail do pagador para fora da chamada. */

/** Cobrança como o Asaas devolve (só o que a API usa). `status` é o texto do Asaas (ex.: `PENDING`, `RECEIVED`). */
export interface CobrancaAsaas {
  id: string;
  assinaturaId: string | null;
  clienteId: string | null;
  /** `dueDate` (AAAA-MM-DD). */
  vencimento: string;
  valorCentavos: number;
  status: string;
}

export interface PixAsaas {
  copiaCola: string;
  qrPngBase64: string;
  expiraEm: string | null;
}

export interface NovoClienteAsaas {
  nome: string;
  email: string;
  /** Só dígitos. Vai ao Asaas e para por aí: nunca é devolvido, gravado nem registrado (CA-24.11). */
  cpfCnpj: string;
  referenciaExterna: string;
}

export interface NovaAssinaturaAsaas {
  clienteId: string;
  valorCentavos: number;
  /** Primeiro vencimento (AAAA-MM-DD). */
  vencimento: string;
  descricao: string;
  referenciaExterna: string;
}

/** Interface do cliente REST (SDD 2.2): a API depende só disto; os testes injetam um falso. */
export interface ClienteAsaas {
  criarCliente(dados: NovoClienteAsaas): Promise<{ id: string }>;
  criarAssinatura(dados: NovaAssinaturaAsaas): Promise<{ id: string }>;
  /** Cobranças já geradas da assinatura (as futuras ainda não existem no Asaas). */
  listarCobrancasDaAssinatura(assinaturaId: string): Promise<CobrancaAsaas[]>;
  /** Nula quando o Asaas não conhece a cobrança (404). */
  buscarCobranca(cobrancaId: string): Promise<CobrancaAsaas | null>;
  buscarPix(cobrancaId: string): Promise<PixAsaas>;
  /** `inexistente` quando o Asaas já não conhece a assinatura (404): para quem cancela, dá no mesmo. */
  cancelarAssinatura(assinaturaId: string): Promise<'cancelada' | 'inexistente'>;
}

/** Evento do webhook já lido e conferido no formato (só ids e datas; SDD 8.5). */
export interface EventoAsaas {
  id: string;
  tipo: string;
  ocorridoEm: Date;
  cobrancaId: string | null;
  assinaturaId: string | null;
}

/**
 * Falha ao falar com o Asaas. Sem corpo da resposta (pode ecoar dado do pagador): só o motivo e o status HTTP.
 * Quem chama decide o que vira para o usuário (503 `indisponivel` ao assinar ou cancelar).
 */
export class ErroAsaas extends Error {
  constructor(
    readonly motivo: 'http' | 'rede' | 'resposta',
    readonly status?: number,
  ) {
    super(`asaas_${motivo}${status ? `_${status}` : ''}`);
    this.name = 'ErroAsaas';
  }
}
