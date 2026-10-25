import type { EntradaPagamentoCartao, SaidaPagamentoCartao } from '@controle/contrato';
import { hojeEmSaoPaulo } from '@controle/dominio';
import {
  buscarContaDoDono,
  inserirPagamentoCartaoSeLivre,
  movimentoEhDoDono,
} from '../../infraestrutura/db/repositorios/contas';
import { buscarFormaDoDono } from '../../infraestrutura/db/repositorios/formas';
import { travarEscritaPorId } from '../../infraestrutura/db/repositorios/idempotencia';
import { erroRegistroInvalido, vinculoDe, type DepsLar } from './comum';

/**
 * `POST /api/formas/:id/pagamentos` (#15; RN-12, RN-13; CA-13.5; RT-03). Grava um movimento de saída
 * (`pagamento_cartao`) na conta de origem do próprio membro, ligado à forma de Crédito da rota. Só debita o saldo:
 * não cria lançamento nem parcela, não entra em total e não abate o gasto do cartão. Forma arquivada é aceita;
 * data futura também (pesa no saldo a partir do dia).
 * Ordem: `valor_invalido` (contrato, como no legado: antes da idempotência) → idempotência (mesmo id do mesmo
 * membro devolve o id com `ja_existia: true`; de outro → `registro_invalido`) → forma que não é Crédito do membro e
 * conta alheia ou arquivada → `registro_invalido`. Origem: A registrar_pagamento_cartao.sql.
 */
export async function registrarPagamentoCartao(
  deps: DepsLar,
  formaId: string,
  entrada: EntradaPagamentoCartao,
): Promise<{ criado: boolean; corpo: SaidaPagamentoCartao }> {
  const v = vinculoDe(deps);
  await travarEscritaPorId(deps.tx, entrada.id);
  if (await movimentoEhDoDono(deps.tx, { id: entrada.id, donoId: v.membroId })) {
    return { criado: false, corpo: { id: entrada.id, ja_existia: true } };
  }
  const forma = await buscarFormaDoDono(deps.tx, { id: formaId, donoId: v.membroId });
  if (!forma || forma.tipo !== 'credito') throw erroRegistroInvalido();
  const conta = await buscarContaDoDono(deps.tx, { id: entrada.conta_id, donoId: v.membroId });
  if (!conta || conta.arquivada) throw erroRegistroInvalido();
  const criou = await inserirPagamentoCartaoSeLivre(deps.tx, {
    id: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    contaId: conta.id,
    formaId: forma.id,
    valorCentavos: entrada.valor_centavos,
    data: entrada.data ?? hojeEmSaoPaulo(deps.agora),
    agora: deps.agora,
  });
  // O id existe e a RLS o esconde (movimento de outro membro ou de outro lar): RT-03.
  if (!criou) throw erroRegistroInvalido();
  return { criado: true, corpo: { id: entrada.id, ja_existia: false } };
}
