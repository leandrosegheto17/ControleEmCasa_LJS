import type { SaidaOrcamentoMes } from '@controle/contrato';
import {
  compararLinhasOrcamento,
  hojeEmSaoPaulo,
  inicioMes,
  mesFechado,
  normalizarValorOrcamento,
  situacaoOrcamento,
  somarMeses,
  type DataCalendario,
} from '@controle/dominio';
import {
  categoriasSemOrcamento,
  orcadoRealizadoDoEscopo,
  orcamentosDoMes,
  type Escopo,
  type LinhaOrcadoRealizado,
} from '../../consultas/orcamento';
import { buscarCategoriaVisivel } from '../../infraestrutura/db/repositorios/categorias';
import {
  copiarOrcamentoDoMesAnterior,
  gravarOrcamento,
  removerOrcamento,
} from '../../infraestrutura/db/repositorios/orcamentos';
import { erroRegistroInvalido, erroValorInvalido, vinculoDe, type DepsLar } from '../lancamentos/comum';

const colacao = new Intl.Collator('pt-BR');

/** Uma linha do orçamento já com percentual e situação (a situação usa a razão exata em inteiros, CA-T5.3). */
export interface LinhaComSituacao {
  categoria_id: string;
  nome: string;
  orcado_centavos: number;
  realizado_centavos: number;
  percentual: number;
  situacao: 'dentro' | 'atencao' | 'estourado';
}

export interface OrcamentoDoEscopo {
  /** Linhas do orçamento, por percentual decrescente e nome. */
  linhas: LinhaComSituacao[];
  /** Nulo quando o escopo não tem orçamento no mês. */
  total: {
    orcado_centavos: number;
    realizado_centavos: number;
    percentual: number;
    situacao: LinhaComSituacao['situacao'];
  } | null;
}

/**
 * Compõe o orçamento de um escopo a partir das linhas já agregadas em SQL (ADR-003): situação por linha e no total
 * (domínio), ordem por percentual e nome. O realizado do total é a soma de TODAS as despesas do escopo no mês,
 * orçadas ou não (CA-16.6); o total é nulo quando o escopo não tem orçamento (RN-16).
 */
export function comporOrcamento(linhas: readonly LinhaOrcadoRealizado[]): OrcamentoDoEscopo {
  const orcadas: LinhaComSituacao[] = [];
  for (const l of linhas) {
    if (l.orcado_centavos === null) continue;
    const s = situacaoOrcamento(l.orcado_centavos, l.realizado_centavos);
    orcadas.push({
      categoria_id: l.categoria_id,
      nome: l.nome,
      orcado_centavos: l.orcado_centavos,
      realizado_centavos: l.realizado_centavos,
      percentual: s.percentual ?? 0,
      situacao: s.situacao,
    });
  }
  if (orcadas.length === 0) return { linhas: [], total: null };
  orcadas.sort(compararLinhasOrcamento);
  const orcado = orcadas.reduce((s, l) => s + l.orcado_centavos, 0);
  const realizado = linhas.reduce((s, l) => s + l.realizado_centavos, 0);
  const t = situacaoOrcamento(orcado, realizado);
  return {
    linhas: orcadas,
    total: {
      orcado_centavos: orcado,
      realizado_centavos: realizado,
      percentual: t.percentual ?? 0,
      situacao: t.situacao,
    },
  };
}

/**
 * `GET /api/orcamento?mes=&escopo=` (#34; RN-16 "Orçamento", RN-17; CA-16.5, CA-16.6, CA-25.1). Mês ausente é o
 * corrente; qualquer dia é normalizado (futuro permitido); escopo ausente é conjunto. No individual só entram o
 * orçamento e as despesas individuais do próprio membro (RN-16c, RN-16e). O total leva `resultado_centavos`
 * (orçado − realizado) e `parcial` enquanto o mês não fechou (RN-16d). `pode_copiar_anterior` vale por escopo: o
 * mês não tem orçamento e o anterior tem; o bloco `anterior` só aparece quando o escopo pedido pode copiar.
 * Leitura: nada aqui depende de plano (RN-25: o Free consulta o que existe).
 */
export async function obterOrcamentoMes(
  deps: DepsLar,
  mesInformado: DataCalendario | undefined,
  escopo: Escopo = 'conjunto',
): Promise<SaidaOrcamentoMes> {
  const v = vinculoDe(deps);
  const hoje = hojeEmSaoPaulo(deps.agora);
  const mes = inicioMes(mesInformado ?? hoje);
  const anterior = somarMeses(mes, -1);
  const visao = { larId: v.larId, membroId: v.membroId };

  const linhas = await orcadoRealizadoDoEscopo(deps.tx, { ...visao, mes, escopo });
  const doMes = await orcamentosDoMes(deps.tx, { ...visao, mes });
  const doAnterior = await orcamentosDoMes(deps.tx, { ...visao, mes: anterior });
  const sem = await categoriasSemOrcamento(deps.tx, { ...visao, mes, escopo });

  const composto = comporOrcamento(linhas);
  const pode = {
    conjunto: doMes.conjunto.categorias === 0 && doAnterior.conjunto.categorias > 0,
    individual: doMes.individual.categorias === 0 && doAnterior.individual.categorias > 0,
  };
  const resposta: SaidaOrcamentoMes = {
    mes,
    escopo,
    pode_copiar_anterior: pode,
    total: composto.total && {
      ...composto.total,
      resultado_centavos: composto.total.orcado_centavos - composto.total.realizado_centavos,
      parcial: !mesFechado(mes, hoje),
    },
    linhas: composto.linhas,
    sem_orcamento: [...sem].sort(
      (a, b) => colacao.compare(a.nome, b.nome) || (a.categoria_id < b.categoria_id ? -1 : 1),
    ),
  };
  if (pode[escopo]) {
    resposta.anterior = {
      mes: anterior,
      orcado_centavos: doAnterior[escopo].orcado_centavos,
      categorias: doAnterior[escopo].categorias,
    };
  }
  return resposta;
}

/**
 * `PUT /api/orcamento/:mes/:categoria_id` (#35; RN-16 "Definir"; CA-T3.5): define o valor da categoria de despesa no
 * mês; valor ausente ou nulo REMOVE (idempotente). O escopo e o dono vêm da categoria, nunca do cliente.
 * Ordem das recusas (a do legado, RT-02): `registro_invalido` (categoria inexistente, de outro lar, individual do
 * outro membro ou de receita) → `valor_invalido` (valor fora de 1 a 10^11) → `registro_invalido` (categoria
 * arquivada não recebe valor; a remoção é aceita). Origem: A definir_orcamento.sql.
 */
export async function definirOrcamento(
  deps: DepsLar,
  dados: { mes: DataCalendario; categoriaId: string; valorCentavos: number | null | undefined },
): Promise<void> {
  const v = vinculoDe(deps);
  const mes = inicioMes(dados.mes);
  const categoria = await buscarCategoriaVisivel(deps.tx, {
    id: dados.categoriaId,
    larId: v.larId,
    membroId: v.membroId,
  });
  if (!categoria || categoria.tipo !== 'despesa') throw erroRegistroInvalido();

  const valor = normalizarValorOrcamento(dados.valorCentavos);
  if (!valor.ok) throw erroValorInvalido();
  if (valor.valor.remover) {
    await removerOrcamento(deps.tx, { larId: v.larId, membroId: v.membroId, mes, categoriaId: categoria.id });
    return;
  }
  if (categoria.arquivada) throw erroRegistroInvalido();
  await gravarOrcamento(deps.tx, {
    larId: v.larId,
    mes,
    categoriaId: categoria.id,
    escopo: categoria.escopo,
    donoId: categoria.escopo === 'individual' ? v.membroId : null,
    valorCentavos: valor.valor.valorCentavos,
    agora: deps.agora,
  });
}

/**
 * `POST /api/orcamento/:mes/copiar` (#36; RN-16 "Copiar"; CA-16.7, CA-T3.5): copia o orçamento do mês anterior no
 * escopo pedido. Não sobrescreve o que o mês já tem, pula categoria arquivada e devolve quantas copiou (0 se nada
 * a copiar). Na individual a origem é só a do próprio membro. Origem: A copiar_orcamento.sql.
 */
export async function copiarOrcamento(
  deps: DepsLar,
  dados: { mes: DataCalendario; escopo: Escopo },
): Promise<{ copiadas: number }> {
  const v = vinculoDe(deps);
  const mes = inicioMes(dados.mes);
  const copiadas = await copiarOrcamentoDoMesAnterior(deps.tx, {
    larId: v.larId,
    membroId: v.membroId,
    mes,
    anterior: somarMeses(mes, -1),
    escopo: dados.escopo,
    agora: deps.agora,
  });
  return { copiadas };
}
