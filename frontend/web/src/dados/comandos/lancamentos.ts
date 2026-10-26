import type { EntradaEditarLancamento, SaidaLancamentoEditado } from '@controle/contrato';
import { ehUuid } from '../../comum/uuid';
import type { CamposLancamento } from '../../comum/lancamentos';
import type { ErroDados } from '../erros';
import { chamar } from '../transporte';

export type { CamposLancamento };

const REGISTRO_INVALIDO: ErroDados = { tipo: 'regra', codigo: 'registro_invalido' };

/**
 * `PATCH /api/lancamentos/:id`. Só os campos recebidos vão no corpo (ausente = não muda, RN-06); quem pode alterar
 * o quê é decisão do servidor.
 */
export async function editarLancamento({
  id,
  campos,
  confirmarDescarte = false,
}: {
  id: string;
  campos: CamposLancamento;
  confirmarDescarte?: boolean;
}): Promise<void> {
  if (!ehUuid(id)) throw REGISTRO_INVALIDO;
  const { valorTotalCentavos, categoriaId, descricao, data, formaId, numParcelas } = campos;
  const corpo: EntradaEditarLancamento = {
    ...(valorTotalCentavos !== undefined && { valor_total_centavos: valorTotalCentavos }),
    ...(categoriaId !== undefined && { categoria_id: categoriaId }),
    ...(descricao !== undefined && { descricao }),
    ...(data !== undefined && { data }),
    ...(formaId !== undefined && { forma_id: formaId }),
    ...(numParcelas !== undefined && { num_parcelas: numParcelas }),
    confirmar_descarte: confirmarDescarte,
  };
  await chamar<SaidaLancamentoEditado>('PATCH', `/api/lancamentos/${id}`, corpo, { saida: 'LancamentoEditado' });
}

/** A edição descartaria ajustes de parcela: a tela confirma e reenvia com `confirmarDescarte`. */
export const ehConfirmarDescarte = (erro: ErroDados | null | undefined): boolean =>
  erro?.tipo === 'regra' && erro.codigo === 'confirmar_descarte_ajustes';

/** `DELETE /api/lancamentos/:id` (204). */
export const excluirLancamento = async (id: string): Promise<void> => {
  if (!ehUuid(id)) throw REGISTRO_INVALIDO;
  await chamar('DELETE', `/api/lancamentos/${id}`);
};

/** `PATCH /api/parcelas/:id` (204): ajuste manual da data (só o pagador, só crédito: o servidor decide). */
export async function alterarDataParcela({ parcelaId, data }: { parcelaId: string; data: string }): Promise<void> {
  if (!ehUuid(parcelaId)) throw REGISTRO_INVALIDO;
  await chamar('PATCH', `/api/parcelas/${parcelaId}`, { data });
}
