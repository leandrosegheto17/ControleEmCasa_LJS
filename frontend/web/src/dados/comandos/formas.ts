import type { SaidaIdSalvo, SaidaPagamentoCartao } from '@controle/contrato';
import type { TipoForma } from '../../comum/enums';
import { chamar } from '../transporte';

export interface DadosSalvarForma {
  id: string;
  nome: string;
  tipo: TipoForma;
  /** Só o crédito leva o dia; nos demais é ignorado. */
  diaVencimento?: number | null;
  /** Nulo limpa a conta de pagamento padrão do cartão. */
  contaId?: string | null;
}

/** `PUT /api/formas/:id`: cria ou atualiza. */
export const salvarForma = (d: DadosSalvarForma) =>
  chamar<SaidaIdSalvo>(
    'PUT',
    `/api/formas/${d.id}`,
    { nome: d.nome, tipo: d.tipo, conta_id: d.contaId ?? null, dia_vencimento: d.diaVencimento ?? null },
    { saida: 'IdSalvo' },
  );

export const arquivarForma = async (id: string): Promise<void> => {
  await chamar('POST', `/api/formas/${id}/arquivar`);
};

export const excluirForma = async (id: string): Promise<void> => {
  await chamar('DELETE', `/api/formas/${id}`);
};

export const definirPreferida = async (id: string, preferida: boolean): Promise<void> => {
  await chamar('PUT', `/api/formas/${id}/preferida`, { preferida });
};

/** O `id` é gerado uma vez por abertura da folha: o reenvio depois de uma falha de rede é idempotente. */
export const registrarPagamentoCartao = (d: {
  id: string;
  formaId: string;
  contaId: string;
  valorCentavos: number;
  data: string;
}) =>
  chamar<SaidaPagamentoCartao>(
    'POST',
    `/api/formas/${d.formaId}/pagamentos`,
    { id: d.id, conta_id: d.contaId, valor_centavos: d.valorCentavos, data: d.data },
    { saida: 'PagamentoCartao' },
  );
