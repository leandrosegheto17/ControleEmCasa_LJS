import { z } from 'zod';
import { DataCalendario } from './lancamento';

/**
 * Contrato das despesas fixas, das ocorrências e do resumo do mês (SDD 6.1 #27 a #33; RN-04, RN-12, RN-13, RN-15,
 * RN-16, RN-28; RT-02, RT-03; G-11, G-22, G-26). Nenhuma entrada aceita `lar_id`, `dono_id`, escopo ou tipo: o lar e
 * o pagador vêm do vínculo validado no banco (G-03) e a fixa é sempre conjunta de despesa (RN-15). Objetos
 * `.strict()`: chave desconhecida é `valor_invalido`.
 *
 * As faixas (descrição, previsto, dia, valor e data do pagamento) NÃO ficam aqui: a ordem das recusas (RT-02) põe
 * `registro_invalido` da ocorrência e da forma antes do `valor_invalido` do valor e da data (A pagar_ocorrencia.sql).
 * Os casos de uso as checam com o domínio. Aqui fica só a forma.
 */

const Centavos = z.number().int().safe();
const Inteiro = z.number().int().safe();
const SituacaoOcorrencia = z.enum(['paga', 'atrasada', 'pendente']);
const SituacaoOrcamento = z.enum(['dentro', 'atencao', 'estourado']);
/** Quem aparece numa ocorrência paga: `sou_eu` é relativo a quem consulta. */
const Pessoa = z.object({ nome: z.string(), sou_eu: z.boolean() }).strict();

export const entradaFixas = {
  /** `PUT /api/fixas/:id` (#28): cria ou edita o modelo; o id vem na rota (ADR-010). */
  SalvarFixa: z
    .object({
      descricao: z.string(),
      categoria_id: z.uuid(),
      valor_previsto_centavos: Centavos,
      dia_vencimento: Inteiro,
    })
    .strict(),
  /** `GET /api/fixas/ocorrencias?mes=` (#30). O mês é normalizado para o dia 1 (CA-T4.2). */
  FiltroOcorrencias: z.object({ mes: DataCalendario }).strict(),
  /** `POST /api/ocorrencias/:id/pagamento` (#31). Valor ausente = previsto; data ausente = hoje (São Paulo). */
  PagarOcorrencia: z
    .object({
      id: z.uuid(),
      forma_id: z.uuid(),
      valor_centavos: Centavos.nullish(),
      data: DataCalendario.nullish(),
    })
    .strict(),
  /** `GET /api/resumo?mes=` (#33). Mês ausente = mês corrente; qualquer dia é normalizado (futuro permitido). */
  FiltroResumo: z.object({ mes: DataCalendario.optional() }).strict(),
} as const;

/** `GET /api/fixas` (#27, item): o modelo, visível aos dois membros. Sem lar nem início. */
const LinhaDespesasFixas = z
  .object({
    id: z.uuid(),
    descricao: z.string(),
    categoria_id: z.uuid(),
    /** Nome da categoria (sempre conjunta). */
    categoria: z.string(),
    valor_previsto_centavos: Centavos,
    dia_vencimento: Inteiro,
    encerrada_em: DataCalendario.nullable(),
  })
  .strict();

/**
 * Ocorrência do mês (F ocorrencias_do_mes.sql). A data mostrada aos dois é o vencimento; forma, conta e data do
 * pagamento nunca saem, para ninguém (§2.1): o schema estrito não as declara.
 */
const OcorrenciaMes = z
  .object({
    id: z.uuid(),
    despesa_fixa_id: z.uuid(),
    descricao: z.string(),
    categoria: z.string(),
    vencimento: DataCalendario,
    valor_previsto_centavos: Centavos,
    /** Soma das parcelas do lançamento ligado; nulo enquanto não paga. */
    valor_pago_centavos: Centavos.nullable(),
    situacao: SituacaoOcorrencia,
    /** Preenchido quando paga. */
    pagador: Pessoa.nullable(),
  })
  .strict();

const OcorrenciasMes = z
  .object({
    mes: DataCalendario,
    pagas: Inteiro,
    total: Inteiro,
    /** Σ previsto das não pagas, atrasadas incluídas (RN-16a). */
    previsto_a_pagar_centavos: Centavos,
    ocorrencias: z.array(OcorrenciaMes),
  })
  .strict();

/** Resposta de pagar (A resposta_pagamento_ocorrencia.sql): mínima, sem campo privado (§2.1). */
const PagamentoOcorrencia = z
  .object({
    ocorrencia_id: z.uuid(),
    lancamento_id: z.uuid(),
    situacao: z.literal('paga'),
    valor_pago_centavos: Centavos,
    vencimento: DataCalendario,
    ja_existia: z.boolean(),
  })
  .strict();

const TotalPorCategoria = z
  .object({ categoria_id: z.uuid(), nome: z.string(), variavel: z.boolean(), total_centavos: Centavos })
  .strict();

const LinhaOrcamento = z
  .object({
    categoria_id: z.uuid(),
    nome: z.string(),
    orcado_centavos: Centavos,
    realizado_centavos: Centavos,
    percentual: Inteiro,
    situacao: SituacaoOrcamento,
  })
  .strict();

/** Total do orçamento de um escopo, com os 3 destaques; nulo quando o escopo não tem orçamento no mês. */
const ResumoOrcamento = z
  .object({
    orcado_centavos: Centavos,
    realizado_centavos: Centavos,
    percentual: Inteiro,
    situacao: SituacaoOrcamento,
    destaques: z.array(LinhaOrcamento),
  })
  .strict();

const ResumoMeta = z
  .object({
    meta_id: z.uuid(),
    nome: z.string(),
    alvo_centavos: Centavos,
    guardado_centavos: Centavos,
    falta_centavos: Centavos,
    percentual: Inteiro,
    prazo: z.string().nullable(),
    mensal_necessario_centavos: Centavos.nullable(),
    atingida: z.boolean(),
  })
  .strict();

/** `true` enquanto o mês não fechou (RN-16d, CA-16.8). */
const ResumoResultado = z.object({ valor_centavos: Centavos, parcial: z.boolean() }).strict();

/**
 * `GET /api/resumo` (#33; A resumo_mes.sql). O bloco `individual` é só de quem consulta (RN-16e): nada nele vem do
 * outro membro. `conjunto` só tem dados conjuntos e pagadores já visíveis.
 */
const ResumoMes = z
  .object({
    mes: DataCalendario,
    mes_fechado: z.boolean(),
    pendentes_previstos_centavos: Centavos,
    conjunto: z
      .object({
        total_centavos: Centavos,
        total_variaveis_centavos: Centavos,
        previsto_a_pagar_centavos: Centavos,
        pago_por_membro: z.array(
          z.object({ membro_id: z.uuid(), nome: z.string(), valor_centavos: Centavos, percentual: Inteiro }).strict(),
        ),
        fixas_total: Inteiro,
        fixas_pendentes: z.array(
          z
            .object({
              ocorrencia_id: z.uuid(),
              descricao: z.string(),
              vencimento: DataCalendario,
              valor_previsto_centavos: Centavos,
              situacao: z.enum(['pendente', 'atrasada']),
            })
            .strict(),
        ),
        orcamento: ResumoOrcamento.nullable(),
        por_categoria: z.array(TotalPorCategoria),
        resultado: ResumoResultado,
        metas: z.array(ResumoMeta),
      })
      .strict(),
    individual: z
      .object({
        meu_total_centavos: Centavos,
        minha_parte_conjunto_centavos: Centavos,
        meu_individual_centavos: Centavos,
        total_variaveis_centavos: Centavos,
        receitas_centavos: Centavos,
        resultado: ResumoResultado,
        guardado_no_mes_centavos: Centavos,
        orcamento: ResumoOrcamento.nullable(),
        por_categoria: z.array(TotalPorCategoria),
        minha_parte_por_categoria: z.array(TotalPorCategoria),
        contas: z.array(z.object({ conta_id: z.uuid(), nome: z.string(), saldo_centavos: Centavos }).strict()),
        credito: z.array(
          z
            .object({
              forma_id: z.uuid(),
              nome: z.string(),
              dia_vencimento: Inteiro,
              gasto_mes_centavos: Centavos,
              comprometido_futuro_centavos: Centavos,
            })
            .strict(),
        ),
        metas: z.array(ResumoMeta),
      })
      .strict(),
  })
  .strict();

export const saidaFixas = {
  LinhaDespesasFixas,
  OcorrenciaMes,
  OcorrenciasMes,
  PagamentoOcorrencia,
  ResumoMes,
} as const;

export type EntradaSalvarFixa = z.infer<typeof entradaFixas.SalvarFixa>;
export type EntradaFiltroOcorrencias = z.infer<typeof entradaFixas.FiltroOcorrencias>;
export type EntradaPagarOcorrencia = z.infer<typeof entradaFixas.PagarOcorrencia>;
export type EntradaFiltroResumo = z.infer<typeof entradaFixas.FiltroResumo>;
export type SaidaLinhaDespesasFixas = z.infer<typeof LinhaDespesasFixas>;
export type SaidaOcorrenciaMes = z.infer<typeof OcorrenciaMes>;
export type SaidaOcorrenciasMes = z.infer<typeof OcorrenciasMes>;
export type SaidaPagamentoOcorrencia = z.infer<typeof PagamentoOcorrencia>;
export type SaidaResumoMes = z.infer<typeof ResumoMes>;
export type SaidaTotalPorCategoria = z.infer<typeof TotalPorCategoria>;

/** Códigos de erro das rotas de fixas e do resumo (SDD 7; PRD-TECNICO 1.1). A lista só cresce. */
export const CODIGOS_ERRO_FIXAS = [
  'valor_invalido',
  'registro_invalido',
  'forma_arquivada',
  'ocorrencia_paga',
] as const;
export type CodigoErroFixas = (typeof CODIGOS_ERRO_FIXAS)[number];
