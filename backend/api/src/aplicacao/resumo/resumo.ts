import type { SaidaResumoMes, SaidaTotalPorCategoria } from '@controle/contrato';
import { hojeEmSaoPaulo, inicioMes, mesFechado, pagoPorMembro, type DataCalendario } from '@controle/dominio';
import { gastoDosCartoes } from '../../consultas/cartao';
import { pagoPorMembroDoMes, somasDoMesPorCategoria, type SomaPorCategoria } from '../../consultas/resumo';
import { listarContasComSaldo } from '../../consultas/saldos';
import { garantirOcorrencias, ocorrenciasComSituacao } from '../fixas/ocorrencias';
import { vinculoDe, type DepsLar } from '../lancamentos/comum';

const colacao = new Intl.Collator('pt-BR');

/** Por categoria (F totais_por_categoria.sql): soma as linhas do bloco por categoria, total desc e nome. */
function porCategoria(linhas: readonly SomaPorCategoria[]): SaidaTotalPorCategoria[] {
  const mapa = new Map<string, SaidaTotalPorCategoria>();
  for (const l of linhas) {
    const atual = mapa.get(l.categoria_id);
    if (atual) atual.total_centavos += l.total_centavos;
    else
      mapa.set(l.categoria_id, {
        categoria_id: l.categoria_id,
        nome: l.nome,
        variavel: l.variavel,
        total_centavos: l.total_centavos,
      });
  }
  return [...mapa.values()]
    .filter((c) => c.total_centavos > 0)
    .sort((a, b) => b.total_centavos - a.total_centavos || colacao.compare(a.nome, b.nome));
}

const soma = (linhas: readonly SomaPorCategoria[], filtro: (l: SomaPorCategoria) => boolean = () => true) =>
  linhas.filter(filtro).reduce((s, l) => s + l.total_centavos, 0);

/**
 * `GET /api/resumo?mes=` (#33; RN-16a a RN-16e, RN-12, RN-13, RN-15; CA-16.1 a CA-16.10, CA-12.4, CA-12.5, CA-13.4;
 * G-12, G-51; A resumo_mes.sql). O mês ausente é o corrente; qualquer dia é normalizado (futuro permitido).
 * As somas sobre parcelas são SQL (ADR-003; `consultas/resumo.ts`); aqui só se compõem os blocos a partir de poucas
 * linhas já agregadas. Antes das fixas, garante as ocorrências do mês (CA-16.9).
 * - `conjunto`: total do casal (Σ despesas conjuntas do mês, de qualquer pagador), variáveis, por categoria,
 *   `pago_por_membro` (o último fecha 100), previsto a pagar e as fixas não pagas;
 * - `individual`: SÓ do membro que consulta (RN-16e): minha parte (conjuntas que eu paguei) + meu individual,
 *   receitas, resultado, contas (saldo atual, até hoje, em qualquer mês) e cartões.
 * Ajuste de saldo e pagamento de cartão são movimentos de conta: não entram em total nenhum (CA-12.4).
 * SPEC_DEVIATION: orçamento, metas e "guardado no mês" são da etapa 10 (as tabelas ainda não existem). Até lá os
 * blocos levam `orcamento: null` (o escopo sem orçamento, como no legado), `metas: []` e `guardado_no_mes_centavos: 0`;
 * o resultado conjunto é "orçado ausente conta 0" − total do casal (RN-16d).
 */
export async function resumoDoMes(deps: DepsLar, mesInformado: DataCalendario | undefined): Promise<SaidaResumoMes> {
  const v = vinculoDe(deps);
  const hoje = hojeEmSaoPaulo(deps.agora);
  const mes = inicioMes(mesInformado ?? hoje);
  const parcial = !mesFechado(mes, hoje);

  await garantirOcorrencias(deps, mes);
  const somas = await somasDoMesPorCategoria(deps.tx, { larId: v.larId, membroId: v.membroId, mes });
  const pagos = await pagoPorMembroDoMes(deps.tx, { larId: v.larId, mes });
  const ocorrencias = await ocorrenciasComSituacao(deps, mes);
  const contas = await listarContasComSaldo(deps.tx, v.membroId, hoje);
  const cartoes = await gastoDosCartoes(deps.tx, v.membroId, mes);

  const conjuntas = somas.filter((l) => l.tipo === 'despesa' && l.escopo === 'conjunto');
  const minhaParte = conjuntas.filter((l) => l.minha);
  const meuIndividual = somas.filter((l) => l.tipo === 'despesa' && l.escopo === 'individual' && l.minha);
  const receitas = soma(somas, (l) => l.tipo === 'receita' && l.minha);

  const totalCasal = soma(conjuntas);
  const totalMinhaParte = soma(minhaParte);
  const totalMeuIndividual = soma(meuIndividual);
  const meuTotal = totalMinhaParte + totalMeuIndividual;
  const naoPagas = ocorrencias.filter((o) => o.situacao !== 'paga');
  const previsto = naoPagas.reduce((s, o) => s + o.valor_previsto_centavos, 0);

  return {
    mes,
    mes_fechado: !parcial,
    pendentes_previstos_centavos: previsto,
    conjunto: {
      total_centavos: totalCasal,
      total_variaveis_centavos: soma(conjuntas, (l) => l.variavel),
      previsto_a_pagar_centavos: previsto,
      pago_por_membro: pagoPorMembro(
        pagos.map((p) => ({ membro_id: p.membro_id, nome: p.nome, valorCentavos: p.valor_centavos })),
      ).map((p) => ({
        membro_id: p.membro_id,
        nome: p.nome,
        valor_centavos: p.valorCentavos,
        percentual: p.percentual,
      })),
      fixas_total: ocorrencias.length,
      fixas_pendentes: naoPagas.map((o) => ({
        ocorrencia_id: o.id,
        descricao: o.descricao,
        vencimento: o.vencimento,
        valor_previsto_centavos: o.valor_previsto_centavos,
        situacao: o.situacao === 'atrasada' ? 'atrasada' : 'pendente',
      })),
      orcamento: null,
      por_categoria: porCategoria(conjuntas),
      resultado: { valor_centavos: 0 - totalCasal, parcial },
      metas: [],
    },
    individual: {
      meu_total_centavos: meuTotal,
      minha_parte_conjunto_centavos: totalMinhaParte,
      meu_individual_centavos: totalMeuIndividual,
      total_variaveis_centavos: soma(minhaParte, (l) => l.variavel) + soma(meuIndividual, (l) => l.variavel),
      receitas_centavos: receitas,
      resultado: { valor_centavos: receitas - meuTotal, parcial },
      guardado_no_mes_centavos: 0,
      orcamento: null,
      por_categoria: porCategoria(meuIndividual),
      minha_parte_por_categoria: porCategoria(minhaParte),
      contas: contas
        .filter((c) => !c.arquivada)
        .sort((a, b) => colacao.compare(a.nome, b.nome))
        .map((c) => ({ conta_id: c.id, nome: c.nome, saldo_centavos: c.saldo_centavos })),
      // CA-13.4: cartão arquivado só aparece enquanto tiver gasto no mês ou comprometido.
      credito: cartoes
        .filter((f) => !f.arquivada || f.gasto_mes_centavos > 0 || f.comprometido_futuro_centavos > 0)
        .map((f) => ({
          forma_id: f.forma_id,
          nome: f.nome,
          dia_vencimento: f.dia_vencimento,
          gasto_mes_centavos: f.gasto_mes_centavos,
          comprometido_futuro_centavos: f.comprometido_futuro_centavos,
        })),
      metas: [],
    },
  };
}
