import type {
  EntradaPagarOcorrencia,
  EntradaSalvarFixa,
  SaidaIdSalvo,
  SaidaPagamentoOcorrencia,
} from '@controle/contrato';
import { ehUuid } from '../../comum/uuid';
import { REGISTRO_INVALIDO } from '../consultas/cadastro';
import { chamar } from '../transporte';

export interface DadosSalvarFixa {
  /** Gerado no cliente e mantido em todas as tentativas: reenviar não cria duas despesas fixas (ADR-010). */
  id: string;
  descricao: string;
  categoriaId: string;
  valorPrevistoCentavos: number;
  diaVencimento: number;
}

/** `PUT /api/fixas/:id`: cria ou edita o modelo (201 ou 200). A fixa é sempre conjunta; o lar vem da sessão. */
export function salvarDespesaFixa(d: DadosSalvarFixa): Promise<SaidaIdSalvo> {
  if (!ehUuid(d.id)) return Promise.reject(REGISTRO_INVALIDO);
  const corpo: EntradaSalvarFixa = {
    descricao: d.descricao,
    categoria_id: d.categoriaId,
    valor_previsto_centavos: d.valorPrevistoCentavos,
    dia_vencimento: d.diaVencimento,
  };
  return chamar<SaidaIdSalvo>('PUT', `/api/fixas/${d.id}`, corpo, { saida: 'IdSalvo' });
}

/** `POST /api/fixas/:id/encerrar` (204): idempotente, a data do encerramento não se move. */
export async function encerrarDespesaFixa(id: string): Promise<void> {
  if (!ehUuid(id)) throw REGISTRO_INVALIDO;
  await chamar('POST', `/api/fixas/${id}/encerrar`);
}

export interface DadosPagarOcorrencia {
  ocorrenciaId: string;
  /** Id do lançamento de pagamento, gerado no cliente: repetir o envio com ele devolve o pagamento já gravado (CA-15.5). */
  id: string;
  formaId: string;
  /** Ausente: o servidor usa o previsto. */
  valorCentavos?: number;
  /** Ausente: o servidor usa hoje (São Paulo). */
  data?: string;
}

/**
 * `POST /api/ocorrencias/:id/pagamento`. O servidor cria o lançamento conjunto do pagador com 1 parcela no
 * vencimento da ocorrência (RN-15, I-20); a data e a forma informadas só alimentam a parte privada dele.
 */
export function pagarOcorrencia(d: DadosPagarOcorrencia): Promise<SaidaPagamentoOcorrencia> {
  if (!ehUuid(d.ocorrenciaId)) return Promise.reject(REGISTRO_INVALIDO);
  const corpo: EntradaPagarOcorrencia = {
    id: d.id,
    forma_id: d.formaId,
    ...(d.valorCentavos !== undefined && { valor_centavos: d.valorCentavos }),
    ...(d.data !== undefined && { data: d.data }),
  };
  return chamar<SaidaPagamentoOcorrencia>('POST', `/api/ocorrencias/${d.ocorrenciaId}/pagamento`, corpo, {
    saida: 'PagamentoOcorrencia',
  });
}

/** `DELETE /api/ocorrencias/:id/pagamento` (204): só o pagador; já pendente é sucesso sem efeito. */
export async function desfazerPagamento(ocorrenciaId: string): Promise<void> {
  if (!ehUuid(ocorrenciaId)) throw REGISTRO_INVALIDO;
  await chamar('DELETE', `/api/ocorrencias/${ocorrenciaId}/pagamento`);
}
