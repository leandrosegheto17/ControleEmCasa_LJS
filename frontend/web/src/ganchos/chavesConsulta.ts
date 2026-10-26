/** Chaves do cache de consulta, num só lugar: leitura e invalidação usam as mesmas. */
export const CHAVES = {
  contas: ['contas'],
  conta: (id: string) => ['contas', id],
  formas: ['formas'],
  forma: (id: string) => ['formas', id],
  categorias: ['categorias'],
  categoria: (id: string) => ['categorias', id],
  /** Raiz do resumo do mês (invalida todos os meses); o mês específico fica em `resumoDoMes`. */
  resumoMes: ['resumo'],
  resumoDoMes: (mes: string) => ['resumo', mes],
  /** Raiz da lista do mês; os filtros e o mês entram depois, na mesma chave. */
  lancamentosMes: ['lancamentos'],
  lancamento: (id: string) => ['lancamento', id],
  dadosLancamento: ['dados_lancamento'],
  dadosLancamentoAparelho: ['dados_lancamento', 'aparelho'],
  despesasFixas: ['despesas_fixas'],
  despesaFixa: (id: string) => ['despesas_fixas', id],
  /** Raiz das ocorrências (todos os meses); o mês específico fica em `ocorrenciasDoMes`. */
  ocorrenciasMes: ['ocorrencias_mes'],
  ocorrenciasDoMes: (mes: string) => ['ocorrencias_mes', mes],
  /** Raiz do orçamento (os dois escopos: `pode_copiar_anterior` cruza escopos). */
  orcamentoMes: ['orcamento_mes'],
  orcamentoDoMes: (mes: string, escopo: string) => ['orcamento_mes', mes, escopo],
  metas: ['metas'],
  meta: (id: string) => ['metas', id],
  movimentosMeta: ['movimentos_meta'],
  movimentosDaMeta: (metaId: string) => ['movimentos_meta', metaId],
  locaisGuardados: ['locais_guardados'],
  /** Membros e convite pendente do lar (`GET /api/lar`). */
  lar: ['lar'],
} as const;

/** O que muda de total quando um lançamento é criado, editado ou excluído: o resumo e o realizado do orçamento. */
export const TOTAIS_DO_MES = [CHAVES.resumoMes, CHAVES.orcamentoMes] as const;
