import type { SaidaResumoMes, SaidaTotalPorCategoria } from '@controle/contrato';
import {
  destaquesOrcamento,
  hojeEmSaoPaulo,
  inicioMes,
  mesFechado,
  pagoPorMembro,
  type DataCalendario,
} from '@controle/dominio';
import { gastoDosCartoes } from '../../consultas/cartao';
import { orcadoRealizadoDoEscopo, type Escopo } from '../../consultas/orcamento';
import { pagoPorMembroDoMes, somasDoMesPorCategoria, type SomaPorCategoria } from '../../consultas/resumo';
import { listarContasComSaldo } from '../../consultas/saldos';
import { guardadoNoMes, listarMetasVisiveis, type MetaGravada } from '../../infraestrutura/db/repositorios/metas';
import { garantirOcorrencias, ocorrenciasComSituacao } from '../fixas/ocorrencias';
import { vinculoDe, type DepsLar } from '../lancamentos/comum';
import { linhaDaMeta } from '../metas/metas';
import { comporOrcamento } from '../orcamento/orcamento';

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

/** Bloco `orcamento` do resumo (F resumo_orcamento.sql): total do escopo e os 3 destaques; nulo sem orçamento. */
async function orcamentoDoResumo(
  deps: DepsLar,
  dados: { larId: string; membroId: string; mes: string; escopo: Escopo },
): Promise<{ resumo: SaidaResumoMes['conjunto']['orcamento']; orcadoCentavos: number }> {
  const { linhas, total } = comporOrcamento(await orcadoRealizadoDoEscopo(deps.tx, dados));
  if (!total) return { resumo: null, orcadoCentavos: 0 };
  return { resumo: { ...total, destaques: destaquesOrcamento(linhas) }, orcadoCentavos: total.orcado_centavos };
}

/** Metas do bloco, com o progresso atual (independente do mês navegado): não atingidas primeiro, depois por nome. */
function metasDoResumo(metas: readonly MetaGravada[], hoje: DataCalendario): SaidaResumoMes['conjunto']['metas'] {
  return metas
    .map((m) => linhaDaMeta(m, hoje))
    .sort((a, b) => Number(a.atingida) - Number(b.atingida) || colacao.compare(a.nome, b.nome))
    .map((l) => ({
      meta_id: l.id,
      nome: l.nome,
      alvo_centavos: l.alvo_centavos,
      guardado_centavos: l.guardado_centavos,
      falta_centavos: l.falta_centavos,
      percentual: l.percentual,
      prazo: l.prazo,
      mensal_necessario_centavos: l.mensal_necessario_centavos,
      atingida: l.atingida,
    }));
}

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
 * Orçamento (etapa 10): cada bloco leva o total do escopo e os 3 destaques (nulo se o escopo não tem orçamento no
 * mês; o individual só compara categorias individuais, RN-16c). O resultado conjunto é o orçado conjunto (ausente
 * conta 0) − total do casal (RN-16d). Metas: o progresso atual das visíveis em cada bloco (CA-08.6). "Guardado no
 * mês" = Σ aportes − Σ retiradas feitos por mim no mês: informativo, pode ser negativo e não reduz o resultado
 * individual (RN-16c; CA-16.10). Free e Pro veem os dados existentes (RN-25).
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
  const visao = { larId: v.larId, membroId: v.membroId };
  const orcConjunto = await orcamentoDoResumo(deps, { ...visao, mes, escopo: 'conjunto' });
  const orcIndividual = await orcamentoDoResumo(deps, { ...visao, mes, escopo: 'individual' });
  const metas = await listarMetasVisiveis(deps.tx, visao);
  const guardado = await guardadoNoMes(deps.tx, { ...visao, mes });

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
      orcamento: orcConjunto.resumo,
      por_categoria: porCategoria(conjuntas),
      resultado: { valor_centavos: orcConjunto.orcadoCentavos - totalCasal, parcial },
      metas: metasDoResumo(
        metas.filter((m) => m.escopo === 'conjunto'),
        hoje,
      ),
    },
    individual: {
      meu_total_centavos: meuTotal,
      minha_parte_conjunto_centavos: totalMinhaParte,
      meu_individual_centavos: totalMeuIndividual,
      total_variaveis_centavos: soma(minhaParte, (l) => l.variavel) + soma(meuIndividual, (l) => l.variavel),
      receitas_centavos: receitas,
      resultado: { valor_centavos: receitas - meuTotal, parcial },
      guardado_no_mes_centavos: guardado,
      orcamento: orcIndividual.resumo,
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
      metas: metasDoResumo(
        metas.filter((m) => m.escopo === 'individual'),
        hoje,
      ),
    },
  };
}
