import type { EntradaEditarLancamento, SaidaLancamentoEditado } from '@controle/contrato';
import {
  avaliarEdicao,
  calcularParcelas,
  detectarMudancas,
  diaParaRecalculo,
  diaVencimentoAplicado,
  edicaoRecalculaParcelas,
  hojeEmSaoPaulo,
  normalizarTextoOpcional,
  parcelasDoPagamentoDeFixa,
  redistribuirValor,
  validarDataPagamentoFixa,
  validarValorLancamento,
  verificarDescarteDeAjustes,
  type ContextoEdicao,
  type EstadoLancamento,
} from '@controle/dominio';
import { buscarCategoriaVisivel, type CategoriaVisivel } from '../../infraestrutura/db/repositorios/categorias';
import { buscarFormaDoDono, type FormaDoDono } from '../../infraestrutura/db/repositorios/formas';
import {
  atualizarLancamento,
  atualizarPagamentoDoDono,
  buscarLancamentoVisivel,
  buscarPagamentoDoDono,
  listarParcelas,
  regravarParcelas,
  regravarValoresDasParcelas,
  type ParcelaNova,
} from '../../infraestrutura/db/repositorios/lancamentos';
import {
  erroCategoriaArquivada,
  erroDe,
  erroFormaArquivada,
  erroRegistroInvalido,
  erroValorInvalido,
  ocorrenciaPagaPor,
  vinculoDe,
  type DepsLar,
} from './comum';

/**
 * `PATCH /api/lancamentos/:id` (#24; RN-06, RN-07, RN-14, RN-28; CA-06.1 a CA-06.6, CA-07.1 a CA-07.3; G-13).
 *
 * Ordem das recusas (RT-02, exceção herdada de editar_lancamento): `registro_invalido` (lançamento invisível;
 * categoria nova invisível ou de outro tipo; forma numa receita; forma nova que não é do pagador) →
 * `sem_permissao` (um único campo sem permissão recusa tudo, antes de gravar; CA-06.2) → `valor_invalido` (valor,
 * descrição, parcelas pela RN-14) → `categoria_arquivada` → `forma_arquivada` → `confirmar_descarte_ajustes`.
 *
 * Dois caminhos (decisão do usuário de 2026-10-25, RN-06 revisada):
 * - **pagador (dono)**: lê a própria parte privada e, se valor, parcelas, data, forma ou categoria mudam,
 *   recalcula todas as parcelas pela RN-14 com o dia congelado (mantém os ids, apaga as que sobram, cria as que
 *   faltam e zera `data_ajustada`; CA-06.4 a CA-06.6);
 * - **outro membro** (só na conjunta): não lê nem grava a parte privada do pagador (G-10). Muda descrição, valor e
 *   categoria conjunta; data, forma e nº de parcelas são `sem_permissao`. Como ele não vê a data da operação nem a
 *   forma, enviar `data` ou `forma_id` sempre conta como mudança. O valor novo é redistribuído mantendo as datas
 *   das parcelas (`redistribuirValor`), sem `confirmar_descarte`.
 *
 * Pagamento de fixa (RN-28, correção P7 do defeito do legado; etapa 9): o lançamento ligado a uma `ocorrencia_fixa`
 * tem sempre 1 parcela NO VENCIMENTO da ocorrência, em categoria conjunta. O pagador muda valor, descrição, data da
 * operação (01/01/2000 a hoje + 30), forma e categoria conjunta, e a parcela não sai do vencimento; categoria
 * individual é `sem_permissao`, nº de parcelas ≠ 1 é `valor_invalido`; o outro membro não muda nada.
 *
 * Toda edição grava `alterado_por` e `alterado_em`, mesmo sem mudança efetiva. A resposta é mínima e sem campo
 * privado, também para o autor (§2.1). Origem: A editar_lancamento.sql (sem o SECURITY DEFINER; SDD D-04).
 */
export async function editarLancamento(
  deps: DepsLar,
  id: string,
  entrada: EntradaEditarLancamento,
): Promise<SaidaLancamentoEditado> {
  const v = vinculoDe(deps);
  const lanc = await buscarLancamentoVisivel(deps.tx, { id, larId: v.larId, membroId: v.membroId, travar: true });
  if (!lanc) throw erroRegistroInvalido();
  const souDono = lanc.dono_id === v.membroId;
  const pagamento = souDono ? await buscarPagamentoDoDono(deps.tx, { lancamentoId: id, donoId: v.membroId }) : null;
  const ocorrencia = await ocorrenciaPagaPor(deps, id);
  const ctx: ContextoEdicao = {
    souDono,
    escopo: lanc.escopo,
    formaCredito: pagamento?.forma_tipo === 'credito',
    pagamentoDeFixa: ocorrencia !== null,
  };

  // registro_invalido: a categoria nova tem de ser visível a quem edita e do mesmo tipo do lançamento.
  let categoriaNova: CategoriaVisivel | null = null;
  if (entrada.categoria_id != null && entrada.categoria_id !== lanc.categoria_id) {
    categoriaNova = await buscarCategoriaVisivel(deps.tx, {
      id: entrada.categoria_id,
      larId: v.larId,
      membroId: v.membroId,
    });
    if (!categoriaNova || categoriaNova.tipo !== lanc.tipo) throw erroRegistroInvalido();
  }
  // Receita não tem forma (RN-06).
  if (lanc.tipo === 'receita' && entrada.forma_id != null) throw erroRegistroInvalido();
  // A forma nova é do pagador; só ele pode trocá-la, então só ele chega a procurá-la.
  let formaNova: FormaDoDono | null = null;
  if (souDono && entrada.forma_id != null && entrada.forma_id !== pagamento?.forma_pagamento_id) {
    formaNova = await buscarFormaDoDono(deps.tx, { id: entrada.forma_id, donoId: v.membroId });
    if (!formaNova) throw erroRegistroInvalido();
  }

  const estado: EstadoLancamento = {
    descricao: lanc.descricao,
    valorTotalCentavos: lanc.valor_total_centavos,
    // O outro membro não enxerga a parte privada: `data` e `forma_id` enviados por ele contam como mudança.
    dataOperacao: pagamento?.data_operacao ?? null,
    formaId: pagamento?.forma_pagamento_id ?? null,
    numParcelas: lanc.num_parcelas,
    categoriaId: lanc.categoria_id,
    escopo: lanc.escopo,
  };
  const mudancas = detectarMudancas(estado, {
    descricao: entrada.descricao,
    valorTotalCentavos: entrada.valor_total_centavos,
    data: entrada.data,
    formaId: entrada.forma_id,
    numParcelas: entrada.num_parcelas,
    categoria: categoriaNova ? { id: categoriaNova.id, escopo: categoriaNova.escopo } : null,
  });
  const avaliacao = avaliarEdicao(ctx, mudancas);
  if (!avaliacao.ok) throw erroDe(avaliacao.erro);

  // valor_invalido
  if (entrada.valor_total_centavos != null && !validarValorLancamento(entrada.valor_total_centavos).ok) {
    throw erroValorInvalido();
  }
  const descricao =
    entrada.descricao == null
      ? { ok: true as const, valor: lanc.descricao }
      : normalizarTextoOpcional(entrada.descricao);
  if (!descricao.ok) throw erroValorInvalido();
  const valor = entrada.valor_total_centavos ?? lanc.valor_total_centavos;
  const numParcelas = entrada.num_parcelas ?? lanc.num_parcelas;

  let recalculo: ParcelaNova[] | null = null;
  let novoPagamento: Parameters<typeof atualizarPagamentoDoDono>[1] | null = null;
  let haAjuste = false;
  if (souDono) {
    if (!pagamento) throw erroRegistroInvalido();
    const tipo = formaNova ? formaNova.tipo : lanc.tipo === 'receita' ? 'receita' : (pagamento.forma_tipo ?? 'pix');
    const formaDominio = formaNova ? { tipo: formaNova.tipo, diaVencimento: formaNova.dia_vencimento } : null;
    const data = entrada.data ?? pagamento.data_operacao;
    const dia = diaParaRecalculo({ diaAplicadoGravado: pagamento.dia_vencimento_aplicado, formaNova: formaDominio });
    if (ocorrencia) {
      // RN-28 (correção P7 do defeito do legado): o pagamento de fixa tem sempre 1 parcela, NO VENCIMENTO da
      // ocorrência, qualquer que seja a forma ou a data da operação; a data da operação nova fica na faixa do
      // pagamento (01/01/2000 a hoje + 30; CA-15.6). A parcela de fixa nunca tem ajuste manual (CA-28.5).
      if (mudancas.data && !validarDataPagamentoFixa(data, hojeEmSaoPaulo(deps.agora)).ok) throw erroValorInvalido();
      if (edicaoRecalculaParcelas(mudancas)) {
        const r = parcelasDoPagamentoDeFixa({ vencimento: ocorrencia.vencimento, valorCentavos: valor, numParcelas });
        if (!r.ok) throw erroValorInvalido();
        recalculo = r.valor;
      }
    } else if (edicaoRecalculaParcelas(mudancas)) {
      const r = calcularParcelas({ tipo, data, diaVencimento: dia, numParcelas, totalCentavos: valor });
      if (!r.ok) throw erroValorInvalido();
      recalculo = r.valor;
      haAjuste = (await listarParcelas(deps.tx, id)).some((p) => p.data_ajustada);
    }
    novoPagamento = {
      lancamentoId: id,
      donoId: v.membroId,
      formaId: formaNova ? formaNova.id : pagamento.forma_pagamento_id,
      contaId: formaNova ? (formaNova.tipo === 'credito' ? null : formaNova.conta_id) : pagamento.conta_id,
      dataOperacao: data,
      diaVencimentoAplicado: formaDominio ? diaVencimentoAplicado(formaDominio) : pagamento.dia_vencimento_aplicado,
    };
  } else if (mudancas.valor) {
    const atuais = await listarParcelas(deps.tx, id);
    const r = redistribuirValor(atuais, valor);
    if (!r.ok) throw erroValorInvalido();
    recalculo = r.valor;
  }

  if (categoriaNova?.arquivada) throw erroCategoriaArquivada();
  if (formaNova?.arquivada) throw erroFormaArquivada();
  const descarte = verificarDescarteDeAjustes({
    recalcula: souDono && recalculo !== null,
    haParcelaAjustada: haAjuste,
    confirmarDescarte: entrada.confirmar_descarte === true,
  });
  if (!descarte.ok) throw erroDe(descarte.erro);

  const escopo = categoriaNova ? categoriaNova.escopo : lanc.escopo;
  await atualizarLancamento(deps.tx, {
    id,
    larId: v.larId,
    categoriaId: categoriaNova ? categoriaNova.id : lanc.categoria_id,
    escopo,
    descricao: descricao.valor,
    valorTotalCentavos: valor,
    numParcelas,
    alteradoPor: v.membroId,
    agora: deps.agora,
  });
  if (novoPagamento) await atualizarPagamentoDoDono(deps.tx, novoPagamento);
  if (recalculo) {
    if (souDono) {
      await regravarParcelas(deps.tx, {
        lancamentoId: id,
        larId: v.larId,
        donoId: lanc.dono_id,
        escopo,
        parcelas: recalculo,
      });
    } else {
      await regravarValoresDasParcelas(deps.tx, { lancamentoId: id, parcelas: recalculo });
    }
  }
  return { id, escopo, num_parcelas: numParcelas, alterado_em: deps.agora.toISOString() };
}
