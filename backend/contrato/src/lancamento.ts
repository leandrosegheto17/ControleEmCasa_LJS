import { z } from 'zod';

/**
 * Contrato dos lançamentos (SDD 6.1 #4, #15 e #20 a #26; RN-01, RN-04, RN-06, RN-07, RN-12 a RN-14, RN-18;
 * RT-02, RT-03; ADR-008, ADR-010; G-11, G-26). Nenhuma entrada aceita `lar_id`, `dono_id` nem escopo: o lar e o
 * dono vêm do vínculo validado no banco (G-03) e o escopo vem da categoria (RN-01, CA-01.2). Os objetos são
 * `.strict()`: chave desconhecida é `valor_invalido`.
 *
 * As faixas de valor, nº de parcelas e tamanho da descrição NÃO ficam aqui, de propósito: a ordem das recusas
 * (RT-02) exige que elas venham depois da idempotência (lançar) e depois de `registro_invalido` e `sem_permissao`
 * (editar). Os casos de uso as checam com o domínio. Aqui fica só a forma (tipos, uuid, data de calendário).
 */

/** Data de calendário real `AAAA-MM-DD` (30/02 é recusado). */
export const DataCalendario = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const [a, m, d] = s.split('-').map(Number) as [number, number, number];
    if (a < 1 || m < 1 || m > 12 || d < 1) return false;
    const dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  });

const Centavos = z.number().int().safe();
const Inteiro = z.number().int().safe();
const Escopo = z.enum(['conjunto', 'individual']);
const TipoLancamento = z.enum(['despesa', 'receita']);
const TipoForma = z.enum(['pix', 'debito', 'credito']);
const Instante = z.iso.datetime({ offset: true });
const IdNome = z.object({ id: z.uuid(), nome: z.string() }).strict();

export const entradaLancamento = {
  /** `POST /api/lancamentos/despesas` (#20). `parcelas` ausente vale 1; `data` ausente vale hoje (São Paulo). */
  LancarDespesa: z
    .object({
      id: z.uuid(),
      valor_centavos: Centavos,
      categoria_id: z.uuid(),
      forma_id: z.uuid(),
      parcelas: Inteiro.optional(),
      data: DataCalendario.nullish(),
      descricao: z.string().nullish(),
    })
    .strict(),
  /** `POST /api/lancamentos/receitas` (#21). Receita é sempre individual, 1 parcela, sem forma. */
  LancarReceita: z
    .object({
      id: z.uuid(),
      valor_centavos: Centavos,
      categoria_id: z.uuid(),
      conta_id: z.uuid(),
      data: DataCalendario.nullish(),
      descricao: z.string().nullish(),
    })
    .strict(),
  /**
   * `GET /api/lancamentos?mes=&escopo=&categoria_id=&forma_id=&variavel=` (#22). O mês é normalizado para o dia 1
   * (CA-T4.2). `variavel` chega como texto (`true`/`false`).
   */
  FiltroLancamentos: z
    .object({
      mes: DataCalendario,
      escopo: Escopo.optional(),
      categoria_id: z.uuid().optional(),
      forma_id: z.uuid().optional(),
      variavel: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
    })
    .strict(),
  /**
   * `PATCH /api/lancamentos/:id` (#24). Campo ausente ou nulo = não muda; descrição `""` (depois do `trim`) limpa
   * (RN-06). `confirmar_descarte` autoriza descartar datas de parcela ajustadas à mão (CA-06.4).
   */
  EditarLancamento: z
    .object({
      valor_total_centavos: Centavos.nullish(),
      categoria_id: z.uuid().nullish(),
      descricao: z.string().nullish(),
      data: DataCalendario.nullish(),
      forma_id: z.uuid().nullish(),
      num_parcelas: Inteiro.nullish(),
      confirmar_descarte: z.boolean().nullish(),
    })
    .strict(),
  /** `PATCH /api/parcelas/:id` (#25): ajuste manual da data (CA-06.7). Data vazia → `valor_invalido`. */
  AlterarDataParcela: z.object({ data: DataCalendario }).strict(),
  /**
   * `POST /api/formas/:id/pagamentos` (#15): pagamento do cartão de crédito da rota, saindo da conta de origem
   * (RN-13). Valor > 0 (RN-18); data ausente vale hoje; data futura é aceita.
   */
  PagamentoCartao: z
    .object({
      id: z.uuid(),
      conta_id: z.uuid(),
      valor_centavos: Centavos.positive(),
      data: DataCalendario.nullish(),
    })
    .strict(),
} as const;

/** Resposta de lançar despesa e receita (A resposta_lancamento.sql): o que foi gravado, mais `ja_existia`. */
const LancamentoGravado = z
  .object({
    id: z.uuid(),
    escopo: Escopo,
    /** Nome da categoria. */
    categoria: z.string(),
    valor_total_centavos: Centavos,
    num_parcelas: Inteiro,
    /** Para a tela avisar "1ª parcela em dd/mm" (CA-14.2). */
    primeira_parcela_data: DataCalendario,
    /** `true` quando o reenvio do mesmo id devolveu o já gravado (RT-03, CA-T3.1). */
    ja_existia: z.boolean(),
  })
  .strict();

const CabecalhoLancamento = {
  id: z.uuid(),
  tipo: TipoLancamento,
  escopo: Escopo,
  descricao: z.string().nullable(),
  categoria: z.object({ id: z.uuid(), nome: z.string(), escopo: Escopo }).strict(),
  valor_total_centavos: Centavos,
  num_parcelas: Inteiro,
  pagador: z.object({ id: z.uuid(), nome: z.string(), sou_eu: z.boolean() }).strict(),
  /** Nulo enquanto o lançamento nunca foi editado (CA-04.4). */
  alterado_por: z.object({ nome: z.string() }).strict().nullable(),
  alterado_em: Instante.nullable(),
  /** Número da parcela com data no mês corrente; sem parcela no mês, a 1ª (CA-04.3). */
  parcela_em_foco: Inteiro,
};

const ParcelaComum = { id: z.uuid(), numero: Inteiro, valor_centavos: Centavos, data: DataCalendario };

/** Detalhe para o pagador (dono): com `pagamento` e `data_ajustada` em cada parcela (CA-04.1). */
const LancamentoDoPagador = z
  .object({
    ...CabecalhoLancamento,
    parcelas: z.array(z.object({ ...ParcelaComum, data_ajustada: z.boolean() }).strict()),
    pagamento: z
      .object({
        /** Nula na receita (CA-04.5). */
        forma: z.object({ id: z.uuid(), nome: z.string(), tipo: TipoForma }).strict().nullable(),
        conta: IdNome.nullable(),
        data_operacao: DataCalendario,
        dia_vencimento_aplicado: Inteiro.nullable(),
      })
      .strict(),
  })
  .strict();

/**
 * Detalhe para o outro membro (G-11, CA-P.1): as chaves `pagamento` e `data_ajustada` NÃO EXISTEM (não vêm
 * nulas). O schema `.strict()` não as declara: uma resposta que as trouxesse falharia na validação.
 */
const LancamentoDoOutroMembro = z
  .object({
    ...CabecalhoLancamento,
    parcelas: z.array(z.object(ParcelaComum).strict()),
  })
  .strict();

const ItemLancamentoMes = z
  .object({
    parcela_id: z.uuid(),
    lancamento_id: z.uuid(),
    data: DataCalendario,
    descricao: z.string().nullable(),
    tipo: TipoLancamento,
    escopo: Escopo,
    categoria: z.object({ id: z.uuid(), nome: z.string(), variavel: z.boolean().nullable() }).strict(),
    valor_centavos: Centavos,
    parcela_numero: Inteiro,
    total_parcelas: Inteiro,
    pagador: IdNome,
  })
  .strict();

export const saidaLancamento = {
  LancarDespesa: LancamentoGravado,
  LancarReceita: LancamentoGravado,
  LancamentoDoPagador,
  LancamentoDoOutroMembro,
  /** `GET /api/lancamentos/:id` (#23): uma das duas formas, conforme quem pede (RN-04). */
  Lancamento: z.union([LancamentoDoPagador, LancamentoDoOutroMembro]),
  ItemLancamentoMes,
  /** `GET /api/lancamentos` (#22). Só despesas entram no total; `quantidade` conta todos os itens filtrados. */
  LancamentosMes: z
    .object({
      mes: DataCalendario,
      filtros: z
        .object({
          escopo: Escopo.nullable(),
          categoria_id: z.uuid().nullable(),
          forma_id: z.uuid().nullable(),
          variavel: z.boolean().nullable(),
        })
        .strict(),
      total_filtrado_centavos: Centavos,
      quantidade: Inteiro,
      itens: z.array(ItemLancamentoMes),
    })
    .strict(),
  /** `PATCH /api/lancamentos/:id` (#24): resposta mínima, sem campo privado, também para o autor (§2.1). */
  LancamentoEditado: z.object({ id: z.uuid(), escopo: Escopo, num_parcelas: Inteiro, alterado_em: Instante }).strict(),
  /** `GET /api/lancamentos/dados` (#4): opções e padrões do lançamento rápido (RN-01). */
  DadosLancamento: z
    .object({
      categorias_despesa: z.array(
        z.object({ id: z.uuid(), nome: z.string(), escopo: Escopo, variavel: z.boolean() }).strict(),
      ),
      categorias_receita: z.array(z.object({ id: z.uuid(), nome: z.string(), escopo: Escopo }).strict()),
      formas: z.array(z.object({ id: z.uuid(), nome: z.string(), tipo: TipoForma, preferida: z.boolean() }).strict()),
      forma_padrao_id: z.uuid().nullable(),
      contas: z.array(IdNome),
      conta_receita_padrao_id: z.uuid().nullable(),
    })
    .strict(),
  /**
   * `POST /api/formas/:id/pagamentos` (#15). SPEC_DEVIATION aceita pelo usuário (2026-10-25): o SDD diz `{ id }`;
   * acrescenta-se `ja_existia` (aditivo), como nas demais escritas de criação (ADR-010 item 2).
   */
  PagamentoCartao: z.object({ id: z.uuid(), ja_existia: z.boolean() }).strict(),
} as const;

export type EntradaLancarDespesa = z.infer<typeof entradaLancamento.LancarDespesa>;
export type EntradaLancarReceita = z.infer<typeof entradaLancamento.LancarReceita>;
export type EntradaFiltroLancamentos = z.output<typeof entradaLancamento.FiltroLancamentos>;
export type EntradaEditarLancamento = z.infer<typeof entradaLancamento.EditarLancamento>;
export type EntradaAlterarDataParcela = z.infer<typeof entradaLancamento.AlterarDataParcela>;
export type EntradaPagamentoCartao = z.infer<typeof entradaLancamento.PagamentoCartao>;
export type SaidaLancamentoGravado = z.infer<typeof LancamentoGravado>;
export type SaidaLancamentoDoPagador = z.infer<typeof LancamentoDoPagador>;
export type SaidaLancamentoDoOutroMembro = z.infer<typeof LancamentoDoOutroMembro>;
export type SaidaLancamento = z.infer<typeof saidaLancamento.Lancamento>;
export type SaidaItemLancamentoMes = z.infer<typeof ItemLancamentoMes>;
export type SaidaLancamentosMes = z.infer<typeof saidaLancamento.LancamentosMes>;
export type SaidaLancamentoEditado = z.infer<typeof saidaLancamento.LancamentoEditado>;
export type SaidaDadosLancamento = z.infer<typeof saidaLancamento.DadosLancamento>;
export type SaidaPagamentoCartao = z.infer<typeof saidaLancamento.PagamentoCartao>;

/** Códigos de erro das rotas de lançamento (SDD 7; PRD-TECNICO 1.1). A lista só cresce. */
export const CODIGOS_ERRO_LANCAMENTO = [
  'valor_invalido',
  'registro_invalido',
  'sem_permissao',
  'confirmar_descarte_ajustes',
  'categoria_arquivada',
  'forma_arquivada',
  'conta_arquivada',
] as const;
export type CodigoErroLancamento = (typeof CODIGOS_ERRO_LANCAMENTO)[number];
