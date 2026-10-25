import type { Centavos } from '@controle/contrato';
import type { DataCalendario } from './datas';
import { recusa, sucesso, type Resultado } from './resultado';
import { normalizarTextoOpcionalSemLimite } from './validacoes';

/**
 * Quem edita o quê num lançamento (RN-06, RN-07, RN-28; G-13). Quem lançou é o pagador e o dono
 * (RN-05): tudo liberado, salvo as correções da fixa (RN-28). O outro membro só alcança a conjunta:
 * muda descrição, valor e categoria conjunta; nunca data, escopo, forma ou parcelas.
 * SPEC_DEVIATION (decisão do usuário de 2026-10-25, etapa 8): no legado o outro membro também mudava a data
 * da conjunta fora do Crédito. A data da operação mora na parte privada do pagador (`lancamento_pagamento`,
 * G-10), que o outro membro não lê nem grava sem `SECURITY DEFINER` (G-04, SDD D-04); por isso a data ficou só
 * com o pagador. Quando o outro membro muda o valor, as parcelas mantêm as datas (`redistribuirValor`).
 * Pagamento de fixa é só do pagador: o outro membro não muda nada.
 * Origem: F permissoes_edicao.sql:38-59; A editar_lancamento.sql:58-157; A alterar_data_parcela.sql.
 */

export type Escopo = 'conjunto' | 'individual';

/** O que a API sabe do lançamento e de quem edita (lido dentro da transação, pela RLS). */
export interface ContextoEdicao {
  /** Quem edita é o dono do lançamento (o pagador, quem lançou). */
  readonly souDono: boolean;
  /** Escopo gravado do lançamento. */
  readonly escopo: Escopo;
  /** A forma gravada do lançamento é Crédito. */
  readonly formaCredito: boolean;
  /** O lançamento é o pagamento de uma ocorrência de despesa fixa. */
  readonly pagamentoDeFixa: boolean;
}

export interface PermissoesEdicao {
  readonly descricao: boolean;
  readonly valor: boolean;
  readonly data: boolean;
  readonly categoriaMesmoEscopo: boolean;
  readonly trocaEscopo: boolean;
  readonly forma: boolean;
  readonly parcelas: boolean;
  /** Alterar a data de uma parcela (ajuste manual, CA-06.7). */
  readonly dataParcela: boolean;
  readonly excluir: boolean;
}

const NADA: PermissoesEdicao = {
  descricao: false,
  valor: false,
  data: false,
  categoriaMesmoEscopo: false,
  trocaEscopo: false,
  forma: false,
  parcelas: false,
  dataParcela: false,
  excluir: false,
};

/**
 * Matriz da RN-06. Lançamento individual do outro membro é invisível: `registro_invalido` (RT-01),
 * o mesmo erro de um id inexistente.
 */
export function permissoesEdicao(ctx: ContextoEdicao): Resultado<PermissoesEdicao, 'registro_invalido'> {
  if (ctx.souDono) {
    return sucesso({
      descricao: true,
      valor: true,
      data: true,
      categoriaMesmoEscopo: true,
      // RN-28 (P7): o pagamento de fixa nunca muda de escopo, nem pelo pagador.
      trocaEscopo: !ctx.pagamentoDeFixa,
      forma: true,
      parcelas: true,
      // CA-06.7 e CA-28.5: só compra no Crédito; a parcela do pagamento de fixa não tem ajuste.
      dataParcela: ctx.formaCredito && !ctx.pagamentoDeFixa,
      excluir: true,
    });
  }
  if (ctx.escopo !== 'conjunto') return recusa('registro_invalido');
  if (ctx.pagamentoDeFixa) return sucesso(NADA);
  return sucesso({
    descricao: true,
    valor: true,
    data: false,
    categoriaMesmoEscopo: true,
    trocaEscopo: false,
    forma: false,
    parcelas: false,
    dataParcela: false,
    excluir: true,
  });
}

/** Estado gravado do lançamento, para saber o que a edição muda de fato. */
export interface EstadoLancamento {
  readonly descricao: string | null;
  readonly valorTotalCentavos: Centavos;
  readonly dataOperacao: DataCalendario | null;
  readonly formaId: string | null;
  readonly numParcelas: number;
  readonly categoriaId: string;
  readonly escopo: Escopo;
}

/**
 * Pedido de edição. Campo ausente (`undefined` ou `null`) = não muda. Descrição `""` (depois do
 * `trim`) limpa a descrição. A categoria nova chega já resolvida pela API (visível a quem edita e do
 * mesmo tipo; senão a API responde `registro_invalido` antes de chamar o domínio).
 */
export interface PedidoEdicao {
  readonly descricao?: string | null;
  readonly valorTotalCentavos?: Centavos | null;
  readonly data?: DataCalendario | null;
  readonly formaId?: string | null;
  readonly numParcelas?: number | null;
  readonly categoria?: { readonly id: string; readonly escopo: Escopo } | null;
}

export interface MudancasEdicao {
  readonly descricao: boolean;
  readonly valor: boolean;
  readonly data: boolean;
  readonly forma: boolean;
  readonly parcelas: boolean;
  readonly categoria: boolean;
  /** A categoria nova tem escopo diferente do gravado (RN-07). */
  readonly trocaEscopo: boolean;
}

const presente = <T>(v: T | null | undefined): v is T => v !== undefined && v !== null;

/**
 * O que muda de fato: parâmetro ausente não muda; parâmetro igual ao gravado não conta como
 * mudança. Origem: A editar_lancamento.sql:78-85.
 */
export function detectarMudancas(estado: EstadoLancamento, pedido: PedidoEdicao): MudancasEdicao {
  const categoria = presente(pedido.categoria) && pedido.categoria.id !== estado.categoriaId;
  return {
    descricao: presente(pedido.descricao) && normalizarTextoOpcionalSemLimite(pedido.descricao) !== estado.descricao,
    valor: presente(pedido.valorTotalCentavos) && pedido.valorTotalCentavos !== estado.valorTotalCentavos,
    data: presente(pedido.data) && pedido.data !== estado.dataOperacao,
    forma: presente(pedido.formaId) && pedido.formaId !== estado.formaId,
    parcelas: presente(pedido.numParcelas) && pedido.numParcelas !== estado.numParcelas,
    categoria,
    trocaEscopo: categoria && pedido.categoria!.escopo !== estado.escopo,
  };
}

/** `true` se a edição recalcula todas as parcelas pela RN-14 (valor, parcelas, data, forma ou categoria). */
export function edicaoRecalculaParcelas(m: MudancasEdicao): boolean {
  return m.valor || m.parcelas || m.data || m.forma || m.categoria;
}

/**
 * Decide a edição antes de gravar qualquer coisa, na ordem do legado: `registro_invalido` →
 * `sem_permissao` → `valor_invalido`. **Um único campo sem permissão recusa a edição inteira**
 * (CA-06.2). No pagamento de fixa, o pagador não muda o nº de parcelas (sempre 1; CA-28.4) nem
 * troca para categoria individual (CA-28.3). Os demais `valor_invalido` (valor, data, N × total),
 * `categoria_arquivada`, `forma_arquivada` e `confirmar_descarte_ajustes` vêm depois, na API.
 * Origem: A editar_lancamento.sql:58-118; F permissoes_edicao.sql:38-59; RN-28.
 */
export function avaliarEdicao(
  ctx: ContextoEdicao,
  mudancas: MudancasEdicao,
): Resultado<void, 'registro_invalido' | 'sem_permissao' | 'valor_invalido'> {
  const perm = permissoesEdicao(ctx);
  if (!perm.ok) return perm;
  const p = perm.valor;
  const semPermissao =
    (mudancas.descricao && !p.descricao) ||
    (mudancas.valor && !p.valor) ||
    (mudancas.data && !p.data) ||
    (mudancas.forma && !p.forma) ||
    (mudancas.parcelas && !p.parcelas) ||
    (mudancas.categoria && mudancas.trocaEscopo && !p.trocaEscopo) ||
    (mudancas.categoria && !mudancas.trocaEscopo && !p.categoriaMesmoEscopo);
  if (semPermissao) return recusa('sem_permissao');
  // RN-28: o pagamento de fixa tem sempre 1 parcela; qualquer mudança do nº é para ≠ 1.
  if (ctx.pagamentoDeFixa && mudancas.parcelas) return recusa('valor_invalido');
  return sucesso(undefined);
}

/**
 * Recalcular descartaria datas de parcela ajustadas à mão: exige `confirmar_descarte = true`
 * (CA-06.4). Origem: A editar_lancamento.sql:147-153.
 */
export function verificarDescarteDeAjustes(entrada: {
  readonly recalcula: boolean;
  readonly haParcelaAjustada: boolean;
  readonly confirmarDescarte: boolean;
}): Resultado<void, 'confirmar_descarte_ajustes'> {
  if (entrada.recalcula && entrada.haParcelaAjustada && !entrada.confirmarDescarte) {
    return recusa('confirmar_descarte_ajustes');
  }
  return sucesso(undefined);
}

/**
 * Alterar a data de uma parcela (CA-06.7, CA-28.5): só o pagador, só compra no Crédito, nunca a
 * parcela do pagamento de fixa. Qualquer outro caso (inexistente, alheia, não Crédito, fixa) dá o
 * mesmo `registro_invalido`, que não revela nada. Origem: A alterar_data_parcela.sql:1-37.
 */
export function podeAlterarDataParcela(ctx: ContextoEdicao): Resultado<void, 'registro_invalido'> {
  const perm = permissoesEdicao(ctx);
  return perm.ok && perm.valor.dataParcela ? sucesso(undefined) : recusa('registro_invalido');
}

/**
 * Excluir o lançamento (RN-06, CA-15.7, CA-28.7): o dono sempre; o outro membro só a conjunta comum.
 * O pagamento de fixa do outro membro e o individual dele dão `registro_invalido`.
 * Origem: A excluir_lancamento.sql:1-31.
 */
export function podeExcluir(ctx: ContextoEdicao): Resultado<void, 'registro_invalido'> {
  const perm = permissoesEdicao(ctx);
  return perm.ok && perm.valor.excluir ? sucesso(undefined) : recusa('registro_invalido');
}
