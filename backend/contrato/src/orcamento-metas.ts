import { z } from 'zod';
import { DataCalendario } from './lancamento';

/**
 * Contrato do orçamento e das metas (SDD 6.1 #34 a #41; RN-08, RN-09, RN-16, RN-18; RT-02, RT-03; G-11, G-26).
 * Nenhuma entrada aceita `lar_id`, `dono_id` ou `autor_id`: o lar e o dono vêm do vínculo validado no banco (G-03);
 * o escopo do orçamento vem da categoria e o da meta só vale na criação (RN-08). Objetos `.strict()`: chave
 * desconhecida é `valor_invalido`.
 *
 * As faixas (valor do orçamento, alvo, valor do movimento, tamanho do nome e do local) NÃO ficam aqui: a ordem das
 * recusas (RT-02; A definir_orcamento.sql, A movimentar_meta.sql) as checa no caso de uso, com o domínio. Aqui fica
 * só a forma.
 */

const Centavos = z.number().int().safe();
const Inteiro = z.number().int().safe();
const Escopo = z.enum(['conjunto', 'individual']);
const SituacaoOrcamento = z.enum(['dentro', 'atencao', 'estourado']);
const Pessoa = z.object({ nome: z.string(), sou_eu: z.boolean() }).strict();

export const entradaOrcamentoMetas = {
  /** `GET /api/orcamento?mes=&escopo=` (#34). Mês ausente = corrente (qualquer dia é normalizado); escopo ausente = conjunto. */
  FiltroOrcamento: z.object({ mes: DataCalendario.optional(), escopo: Escopo.optional() }).strict(),
  /** `PUT /api/orcamento/:mes/:categoria_id` (#35): valor ausente ou nulo remove (idempotente; CA-T3.5). */
  DefinirOrcamento: z.object({ valor_centavos: Centavos.nullish() }).strict(),
  /** `POST /api/orcamento/:mes/copiar` (#36). */
  CopiarOrcamento: z.object({ escopo: Escopo }).strict(),
  /** `PUT /api/metas/:id` (#38): cria ou edita; o id vem na rota (ADR-010). O escopo é obrigatório só na criação. */
  SalvarMeta: z
    .object({
      nome: z.string(),
      alvo_centavos: Centavos,
      /** Qualquer dia do mês do prazo; gravado como dia 1. */
      prazo: DataCalendario.nullish(),
      escopo: Escopo.optional(),
    })
    .strict(),
  /** `POST /api/metas/:id/movimentos` (#39). Data ausente = hoje (São Paulo); conta opcional. */
  MovimentarMeta: z
    .object({
      id: z.uuid(),
      tipo: z.enum(['aporte', 'retirada']),
      valor_centavos: Centavos,
      local: z.string(),
      data: DataCalendario.nullish(),
      conta_id: z.uuid().nullish(),
    })
    .strict(),
} as const;

const CategoriaSemOrcamento = z.object({ categoria_id: z.uuid(), nome: z.string() }).strict();

const LinhaOrcamentoMes = z
  .object({
    categoria_id: z.uuid(),
    nome: z.string(),
    orcado_centavos: Centavos,
    realizado_centavos: Centavos,
    percentual: Inteiro,
    situacao: SituacaoOrcamento,
  })
  .strict();

/** `GET /api/orcamento` (#34; A orcamento_mes.sql). Individual: só do membro que consulta. */
const OrcamentoMes = z
  .object({
    mes: DataCalendario,
    escopo: Escopo,
    pode_copiar_anterior: z.object({ conjunto: z.boolean(), individual: z.boolean() }).strict(),
    /** Presente só quando o escopo pedido pode copiar. */
    anterior: z.object({ mes: DataCalendario, orcado_centavos: Centavos, categorias: Inteiro }).strict().optional(),
    /** Nulo quando o escopo não tem orçamento no mês. */
    total: z
      .object({
        orcado_centavos: Centavos,
        realizado_centavos: Centavos,
        percentual: Inteiro,
        situacao: SituacaoOrcamento,
        resultado_centavos: Centavos,
        parcial: z.boolean(),
      })
      .strict()
      .nullable(),
    linhas: z.array(LinhaOrcamentoMes),
    sem_orcamento: z.array(CategoriaSemOrcamento),
  })
  .strict();

/** `GET /api/metas` (#37) e `GET /api/metas/:id`: `por_local` só no detalhe. */
const LinhaMetas = z
  .object({
    id: z.uuid(),
    nome: z.string(),
    escopo: Escopo,
    alvo_centavos: Centavos,
    guardado_centavos: Centavos,
    falta_centavos: Centavos,
    percentual: Inteiro,
    /** `AAAA-MM`. */
    prazo: z.string().nullable(),
    mensal_necessario_centavos: Centavos.nullable(),
    atingida: z.boolean(),
    por_local: z.array(z.object({ local: z.string(), guardado_centavos: Centavos }).strict()).optional(),
  })
  .strict();

/** Movimento da meta (#40). A chave `conta` existe só nas linhas do próprio autor (RN-08, CA-08.5). */
const MovimentoMeta = z
  .object({
    id: z.uuid(),
    tipo: z.enum(['aporte', 'retirada']),
    valor_centavos: Centavos,
    data: DataCalendario,
    local: z.string(),
    autor: Pessoa,
    conta: z.object({ nome: z.string() }).strict().optional(),
  })
  .strict();

export const saidaOrcamentoMetas = {
  OrcamentoMes,
  LinhaMetas,
  MovimentoMeta,
  MovimentosMeta: z.array(MovimentoMeta),
  /** `GET /api/metas/locais` (#41): do uso mais recente ao mais antigo. */
  LocaisGuardados: z.array(z.string()),
  /** `POST /api/orcamento/:mes/copiar` (#36). */
  CopiaDeOrcamento: z.object({ copiadas: Inteiro }).strict(),
} as const;

export type EntradaFiltroOrcamento = z.infer<typeof entradaOrcamentoMetas.FiltroOrcamento>;
export type EntradaDefinirOrcamento = z.infer<typeof entradaOrcamentoMetas.DefinirOrcamento>;
export type EntradaCopiarOrcamento = z.infer<typeof entradaOrcamentoMetas.CopiarOrcamento>;
export type EntradaSalvarMeta = z.infer<typeof entradaOrcamentoMetas.SalvarMeta>;
export type EntradaMovimentarMeta = z.infer<typeof entradaOrcamentoMetas.MovimentarMeta>;
export type SaidaOrcamentoMes = z.infer<typeof OrcamentoMes>;
export type SaidaLinhaMetas = z.infer<typeof LinhaMetas>;
export type SaidaMovimentoMeta = z.infer<typeof MovimentoMeta>;

/** Códigos de erro do orçamento e das metas (SDD 7; PRD-TECNICO 1.1). A lista só cresce. */
export const CODIGOS_ERRO_ORCAMENTO_METAS = [
  'valor_invalido',
  'registro_invalido',
  'retirada_maior_que_guardado',
] as const;
export type CodigoErroOrcamentoMetas = (typeof CODIGOS_ERRO_ORCAMENTO_METAS)[number];
