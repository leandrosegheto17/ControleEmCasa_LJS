import type { EntradaAlterarDataParcela } from '@controle/contrato';
import { podeAlterarDataParcela, podeExcluir } from '@controle/dominio';
import {
  ajustarDataDaParcela,
  buscarLancamentoVisivel,
  buscarParcelaDoDono,
  excluirLancamento as excluirLancamentoNoBanco,
} from '../../infraestrutura/db/repositorios/lancamentos';
import { erroDe, erroRegistroInvalido, ocorrenciaPagaPor, vinculoDe, type DepsLar } from './comum';

/**
 * `PATCH /api/parcelas/:id` (#25; CA-06.7, CA-28.5; ADR-008 item 5): só o pagador (dono da parcela), só compra no
 * Crédito, nunca a parcela de pagamento de fixa. Só aquela parcela muda, com `data_ajustada = true`, e passa a contar
 * no mês da nova data. Inexistente, de outro membro, de outro lar ou compra que não é de Crédito: o mesmo
 * `registro_invalido`. A data vazia (`valor_invalido`) é recusada antes, pelo contrato, na rota. Repetir a data é
 * aceito. Origem: A alterar_data_parcela.sql.
 */
export async function alterarDataDaParcela(
  deps: DepsLar,
  id: string,
  entrada: EntradaAlterarDataParcela,
): Promise<void> {
  const v = vinculoDe(deps);
  const parcela = await buscarParcelaDoDono(deps.tx, { id, larId: v.larId, donoId: v.membroId });
  if (!parcela) throw erroRegistroInvalido();
  const pode = podeAlterarDataParcela({
    souDono: true,
    // O escopo não muda a regra para o dono; o domínio só o usa para o outro membro.
    escopo: 'conjunto',
    formaCredito: parcela.forma_tipo === 'credito',
    pagamentoDeFixa: (await ocorrenciaPagaPor(deps, parcela.lancamento_id)) !== null,
  });
  if (!pode.ok) throw erroDe(pode.erro);
  await ajustarDataDaParcela(deps.tx, { id, donoId: v.membroId, data: entrada.data });
}

/**
 * `DELETE /api/lancamentos/:id` (#26; RN-06; CA-06.8, CA-15.7, CA-28.7): o dono sempre; o outro membro só a
 * conjunta comum (o pagamento de fixa é só do pagador). Parcelas e parte privada somem juntas pela cascata.
 * Inexistente, individual do outro ou pagamento de fixa do outro: `registro_invalido`. A confirmação é da tela.
 * Excluir o pagamento de uma fixa volta a ocorrência a pendente (SDD #26; RN-15): a FK da ocorrência é
 * `on delete set null`. Origem: A excluir_lancamento.sql.
 */
export async function excluirLancamento(deps: DepsLar, id: string): Promise<void> {
  const v = vinculoDe(deps);
  const lanc = await buscarLancamentoVisivel(deps.tx, { id, larId: v.larId, membroId: v.membroId, travar: true });
  if (!lanc) throw erroRegistroInvalido();
  const pode = podeExcluir({
    souDono: lanc.dono_id === v.membroId,
    escopo: lanc.escopo,
    formaCredito: false,
    pagamentoDeFixa: (await ocorrenciaPagaPor(deps, id)) !== null,
  });
  if (!pode.ok) throw erroDe(pode.erro);
  if ((await excluirLancamentoNoBanco(deps.tx, { id, larId: v.larId, membroId: v.membroId })) !== 1) {
    throw erroRegistroInvalido();
  }
}
