import type { EntradaPagarOcorrencia, SaidaOcorrenciasMes, SaidaPagamentoOcorrencia } from '@controle/contrato';
import {
  compararOcorrencias,
  diaVencimentoAplicado,
  hojeEmSaoPaulo,
  inicioMes,
  ocorrenciasAGerar,
  parcelasDoPagamentoDeFixa,
  situacaoOcorrencia,
  validarDataPagamentoFixa,
  validarValorLancamento,
  type DataCalendario,
} from '@controle/dominio';
import { ErroApi } from '../../erros';
import {
  buscarOcorrenciaDoLar,
  fixasQuePodemGerar,
  inserirOcorrencias,
  ligarPagamento,
  ocorrenciasDoMes,
  pagamentoGravado,
} from '../../infraestrutura/db/repositorios/fixas';
import { buscarFormaDoDono } from '../../infraestrutura/db/repositorios/formas';
import { travarEscritaPorId } from '../../infraestrutura/db/repositorios/idempotencia';
import {
  buscarLancamentoVisivel,
  excluirLancamento,
  inserirLancamentoSeLivre,
  inserirPagamento,
  inserirParcelas,
} from '../../infraestrutura/db/repositorios/lancamentos';
import {
  erroFormaArquivada,
  erroRegistroInvalido,
  erroValorInvalido,
  vinculoDe,
  type DepsLar,
} from '../lancamentos/comum';

/**
 * Ocorrências das despesas fixas (RN-15, RN-28; SDD 6.1 #30 a #32). A ocorrência é do lar (os dois membros a veem
 * e qualquer um paga); o pagamento é um lançamento CONJUNTO do pagador, com 1 parcela no vencimento (I-20), e a
 * parte privada (forma, conta, data da operação) é só dele (G-10). Nenhuma resposta daqui traz forma, conta ou data
 * do pagamento, nem para o próprio pagador (§2.1).
 */

export const erroOcorrenciaPaga = () => new ErroApi(409, 'ocorrencia_paga', 'Esta despesa fixa já está paga.');

/**
 * Garante as ocorrências do mês (CA-15.1, CA-15.2, CA-16.9): 1 por fixa que gera, só dentro da janela de ±12 meses;
 * fora dela nada é gravado. `INSERT … ON CONFLICT DO NOTHING`: idempotente também sob concorrência.
 * Origem: F garantir_ocorrencias.sql.
 */
export async function garantirOcorrencias(deps: DepsLar, mes: DataCalendario): Promise<void> {
  const v = vinculoDe(deps);
  const hoje = hojeEmSaoPaulo(deps.agora);
  const fixas = await fixasQuePodemGerar(deps.tx, { larId: v.larId, mes });
  const novas = ocorrenciasAGerar(
    fixas.map((f) => ({
      id: f.id,
      inicio: f.inicio,
      encerradaEm: f.encerrada_em,
      diaVencimento: f.dia_vencimento,
      valorPrevistoCentavos: f.valor_previsto_centavos,
    })),
    mes,
    hoje,
  );
  await inserirOcorrencias(deps.tx, { larId: v.larId, ocorrencias: novas });
}

/**
 * Ocorrências do mês já garantidas, com situação e na ordem da RN-15 (atrasadas, pendentes por vencimento crescente,
 * pagas por vencimento decrescente). Base de `GET /api/fixas/ocorrencias` e do bloco de fixas do resumo.
 */
export async function ocorrenciasComSituacao(
  deps: DepsLar,
  mes: DataCalendario,
): Promise<SaidaOcorrenciasMes['ocorrencias']> {
  const v = vinculoDe(deps);
  const hoje = hojeEmSaoPaulo(deps.agora);
  const linhas = await ocorrenciasDoMes(deps.tx, { larId: v.larId, mes });
  return linhas
    .map((o) => ({
      id: o.id,
      despesa_fixa_id: o.despesa_fixa_id,
      descricao: o.descricao,
      categoria: o.categoria,
      vencimento: o.vencimento,
      valor_previsto_centavos: o.valor_previsto_centavos,
      valor_pago_centavos: o.paga ? o.valor_pago_centavos : null,
      situacao: situacaoOcorrencia({ paga: o.paga, vencimento: o.vencimento, hoje }),
      pagador:
        o.paga && o.pagador_id !== null && o.pagador_nome !== null
          ? { nome: o.pagador_nome, sou_eu: o.pagador_id === v.membroId }
          : null,
    }))
    .sort(compararOcorrencias);
}

/**
 * `GET /api/fixas/ocorrencias?mes=` (#30; RN-15; CA-15.1 a CA-15.3): garante e lista as ocorrências do mês
 * (normalizado para o dia 1). `previsto_a_pagar_centavos` soma o previsto das não pagas, atrasadas inclusive.
 * Origem: A ocorrencias_mes.sql.
 */
export async function ocorrenciasDoMesComGarantia(
  deps: DepsLar,
  mesInformado: DataCalendario,
): Promise<SaidaOcorrenciasMes> {
  const mes = inicioMes(mesInformado);
  await garantirOcorrencias(deps, mes);
  const ocorrencias = await ocorrenciasComSituacao(deps, mes);
  return {
    mes,
    pagas: ocorrencias.filter((o) => o.situacao === 'paga').length,
    total: ocorrencias.length,
    previsto_a_pagar_centavos: ocorrencias
      .filter((o) => o.situacao !== 'paga')
      .reduce((s, o) => s + o.valor_previsto_centavos, 0),
    ocorrencias,
  };
}

export interface ResultadoPagar {
  criado: boolean;
  corpo: SaidaPagamentoOcorrencia;
}

async function resposta(deps: DepsLar, ocorrenciaId: string, jaExistia: boolean): Promise<SaidaPagamentoOcorrencia> {
  const r = await pagamentoGravado(deps.tx, { ocorrenciaId, larId: vinculoDe(deps).larId });
  if (!r) throw erroRegistroInvalido();
  return { ...r, situacao: 'paga', ja_existia: jaExistia };
}

/**
 * `POST /api/ocorrencias/:id/pagamento` (#31; RN-15, RN-28; CA-15.5, CA-15.6, CA-15.8, CA-13.3; RT-03).
 * Ordem das recusas (RT-02): idempotência (o id já gravado por ESTE membro e ligado a ESTA ocorrência devolve o
 * gravado com `ja_existia: true`; qualquer outro uso do id é `registro_invalido`) → `registro_invalido` (ocorrência
 * do lar; forma do pagador) → `valor_invalido` (valor de 1 a 10^11; data de 01/01/2000 a hoje + 30) →
 * `forma_arquivada` → `ocorrencia_paga`.
 * SPEC_DEVIATION: no legado (A pagar_ocorrencia.sql) `ocorrencia_paga` vinha logo depois da ocorrência, antes da forma
 * e do valor; aqui vale a ordem da RT-02, que põe `ocorrencia_paga` entre as "demais regras" (item 7).
 * Cria um lançamento CONJUNTO do pagador na categoria da fixa, com 1 parcela NA DATA DE VENCIMENTO da ocorrência
 * (I-20, CA-15.8), qualquer que seja a forma; Pix/Débito debitam a conta da forma na data da operação; o Crédito não
 * toca conta e guarda o dia congelado (o cartão o mostra na data de cartão, RN-13).
 */
export async function pagarOcorrencia(
  deps: DepsLar,
  ocorrenciaId: string,
  entrada: EntradaPagarOcorrencia,
): Promise<ResultadoPagar> {
  const v = vinculoDe(deps);
  await travarEscritaPorId(deps.tx, entrada.id);
  const existente = await buscarLancamentoVisivel(deps.tx, { id: entrada.id, larId: v.larId, membroId: v.membroId });
  if (existente) {
    const ligada = await buscarOcorrenciaDoLar(deps.tx, { id: ocorrenciaId, larId: v.larId });
    if (existente.dono_id === v.membroId && ligada?.lancamento_id === entrada.id) {
      return { criado: false, corpo: await resposta(deps, ocorrenciaId, true) };
    }
    throw erroRegistroInvalido();
  }

  const ocorrencia = await buscarOcorrenciaDoLar(deps.tx, { id: ocorrenciaId, larId: v.larId });
  if (!ocorrencia) throw erroRegistroInvalido();
  const forma = await buscarFormaDoDono(deps.tx, { id: entrada.forma_id, donoId: v.membroId });
  if (!forma) throw erroRegistroInvalido();

  const valor = validarValorLancamento(entrada.valor_centavos ?? ocorrencia.valor_previsto_centavos);
  if (!valor.ok) throw erroValorInvalido();
  const hoje = hojeEmSaoPaulo(deps.agora);
  const data = validarDataPagamentoFixa(entrada.data ?? hoje, hoje);
  if (!data.ok) throw erroValorInvalido();
  const parcelas = parcelasDoPagamentoDeFixa({
    vencimento: ocorrencia.vencimento,
    valorCentavos: valor.valor,
    numParcelas: 1,
  });
  if (!parcelas.ok) throw erroValorInvalido();

  if (forma.arquivada) throw erroFormaArquivada();
  if (ocorrencia.lancamento_id !== null) throw erroOcorrenciaPaga();

  const criou = await inserirLancamentoSeLivre(deps.tx, {
    id: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    tipo: 'despesa',
    escopo: 'conjunto',
    categoriaId: ocorrencia.categoria_id,
    descricao: ocorrencia.descricao,
    valorTotalCentavos: valor.valor,
    numParcelas: 1,
    agora: deps.agora,
  });
  // O id existe e a RLS o esconde (individual do outro membro ou de outro lar): RT-03.
  if (!criou) throw erroRegistroInvalido();
  await inserirPagamento(deps.tx, {
    lancamentoId: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    formaId: forma.id,
    contaId: forma.tipo === 'credito' ? null : forma.conta_id,
    dataOperacao: data.valor,
    diaVencimentoAplicado: diaVencimentoAplicado({ tipo: forma.tipo, diaVencimento: forma.dia_vencimento }),
  });
  await inserirParcelas(deps.tx, {
    lancamentoId: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    escopo: 'conjunto',
    parcelas: parcelas.valor,
  });
  await ligarPagamento(deps.tx, { ocorrenciaId, larId: v.larId, lancamentoId: entrada.id });
  return { criado: true, corpo: await resposta(deps, ocorrenciaId, false) };
}

/**
 * `DELETE /api/ocorrencias/:id/pagamento` (#32; RN-15; CA-15.7, CA-28.7, CA-T3.5): só o pagador desfaz. Apaga o
 * lançamento ligado (parcela e parte privada pela cascata) e a ocorrência volta a pendente (FK `on delete set null`).
 * Já pendente: sucesso sem efeito. Inexistente, de outro lar ou paga pelo outro membro: o mesmo `registro_invalido`.
 * Origem: A desfazer_pagamento.sql.
 */
export async function desfazerPagamento(deps: DepsLar, ocorrenciaId: string): Promise<void> {
  const v = vinculoDe(deps);
  const ocorrencia = await buscarOcorrenciaDoLar(deps.tx, { id: ocorrenciaId, larId: v.larId });
  if (!ocorrencia) throw erroRegistroInvalido();
  if (ocorrencia.lancamento_id === null) return;
  const lanc = await buscarLancamentoVisivel(deps.tx, {
    id: ocorrencia.lancamento_id,
    larId: v.larId,
    membroId: v.membroId,
    travar: true,
  });
  if (!lanc || lanc.dono_id !== v.membroId) throw erroRegistroInvalido();
  if ((await excluirLancamento(deps.tx, { id: lanc.id, larId: v.larId, membroId: v.membroId })) !== 1) {
    throw erroRegistroInvalido();
  }
}
