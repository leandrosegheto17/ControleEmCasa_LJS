import type {
  EntradaFiltroLancamentos,
  SaidaDadosLancamento,
  SaidaLancamento,
  SaidaLancamentosMes,
} from '@controle/contrato';
import { hojeEmSaoPaulo, inicioMes } from '@controle/dominio';
import { cabecalhoDoDetalhe, dadosDoLancamento, itensDoMes, pagamentoDoDetalhe } from '../../consultas/lancamentos';
import { listarParcelas } from '../../infraestrutura/db/repositorios/lancamentos';
import { erroRegistroInvalido, vinculoDe, type DepsLar } from './comum';

/**
 * `GET /api/lancamentos/:id` (#23; RN-04; CA-04.1 a CA-04.5, CA-P.1; G-11, D-4). Para o pagador (dono), as
 * parcelas trazem `data_ajustada` e a resposta traz `pagamento`; para o outro membro essas chaves NÃO EXISTEM
 * no objeto (não vêm nulas): o objeto é montado sem elas, nunca com `delete` ou spread de uma linha privada.
 * Inexistente, de outro lar ou individual do outro membro: `registro_invalido` (RT-01). Origem: A lancamento.sql.
 */
export async function detalheDoLancamento(deps: DepsLar, id: string): Promise<SaidaLancamento> {
  const v = vinculoDe(deps);
  const l = await cabecalhoDoDetalhe(deps.tx, { id, larId: v.larId, membroId: v.membroId });
  if (!l) throw erroRegistroInvalido();
  const souPagador = l.pagador_id === v.membroId;
  const parcelas = await listarParcelas(deps.tx, id);
  const mes = inicioMes(hojeEmSaoPaulo(deps.agora));
  const noMes = parcelas.find((p) => inicioMes(p.data) === mes);
  const cabecalho = {
    id: l.id,
    tipo: l.tipo,
    escopo: l.escopo,
    descricao: l.descricao,
    categoria: { id: l.categoria_id, nome: l.categoria_nome, escopo: l.categoria_escopo },
    valor_total_centavos: l.valor_total_centavos,
    num_parcelas: l.num_parcelas,
    pagador: { id: l.pagador_id, nome: l.pagador_nome, sou_eu: souPagador },
    alterado_por: l.alterado_por_nome === null ? null : { nome: l.alterado_por_nome },
    alterado_em: l.alterado_em === null ? null : l.alterado_em.toISOString(),
    parcela_em_foco: (noMes ?? parcelas[0])?.numero ?? 1,
  };

  const pagamento = souPagador ? await pagamentoDoDetalhe(deps.tx, { lancamentoId: id, donoId: v.membroId }) : null;
  if (!souPagador || !pagamento) {
    // Outro membro (ou conjunta de quem saiu, sem parte privada): só as chaves públicas.
    return {
      ...cabecalho,
      parcelas: parcelas.map((p) => ({ id: p.id, numero: p.numero, valor_centavos: p.valor_centavos, data: p.data })),
    };
  }
  return {
    ...cabecalho,
    parcelas: parcelas.map((p) => ({
      id: p.id,
      numero: p.numero,
      valor_centavos: p.valor_centavos,
      data: p.data,
      data_ajustada: p.data_ajustada,
    })),
    pagamento: {
      forma:
        pagamento.forma_id && pagamento.forma_nome !== null && pagamento.forma_tipo !== null
          ? { id: pagamento.forma_id, nome: pagamento.forma_nome, tipo: pagamento.forma_tipo }
          : null,
      conta:
        pagamento.conta_id && pagamento.conta_nome !== null
          ? { id: pagamento.conta_id, nome: pagamento.conta_nome }
          : null,
      data_operacao: pagamento.data_operacao,
      dia_vencimento_aplicado: pagamento.dia_vencimento_aplicado,
    },
  };
}

/**
 * `GET /api/lancamentos?mes=…` (#22; RN-02, RN-04; CA-02.1, CA-P.2, CA-T4.2). Parcelas visíveis do mês com os
 * filtros; `total_filtrado_centavos` soma só as despesas; `quantidade` conta todos os itens. O mês é normalizado
 * para o dia 1. Nenhum item traz forma, conta ou data da operação (G-11). Origem: A lancamentos_mes.sql.
 */
export async function lancamentosDoMes(deps: DepsLar, filtro: EntradaFiltroLancamentos): Promise<SaidaLancamentosMes> {
  const v = vinculoDe(deps);
  const mes = inicioMes(filtro.mes);
  const filtros = {
    escopo: filtro.escopo ?? null,
    categoria_id: filtro.categoria_id ?? null,
    forma_id: filtro.forma_id ?? null,
    variavel: filtro.variavel ?? null,
  };
  const itens = await itensDoMes(deps.tx, {
    larId: v.larId,
    membroId: v.membroId,
    mes,
    escopo: filtros.escopo,
    categoriaId: filtros.categoria_id,
    formaId: filtros.forma_id,
    variavel: filtros.variavel,
  });
  return {
    mes,
    filtros,
    total_filtrado_centavos: itens.filter((i) => i.tipo === 'despesa').reduce((s, i) => s + i.valor_centavos, 0),
    quantidade: itens.length,
    itens: itens.map((i) => ({
      parcela_id: i.parcela_id,
      lancamento_id: i.lancamento_id,
      data: i.data,
      descricao: i.descricao,
      tipo: i.tipo,
      escopo: i.escopo,
      categoria: { id: i.categoria_id, nome: i.categoria_nome, variavel: i.variavel },
      valor_centavos: i.valor_centavos,
      parcela_numero: i.parcela_numero,
      total_parcelas: i.total_parcelas,
      pagador: { id: i.pagador_id, nome: i.pagador_nome },
    })),
  };
}

/** `GET /api/lancamentos/dados` (#4; RN-01): opções e padrões do lançamento rápido do membro. */
export async function dadosDoLancamentoRapido(deps: DepsLar): Promise<SaidaDadosLancamento> {
  const v = vinculoDe(deps);
  return dadosDoLancamento(deps.tx, { larId: v.larId, membroId: v.membroId });
}
