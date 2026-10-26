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
} as const;

/** O que muda de total quando um lançamento é criado, editado ou excluído (o orçamento é do lote seguinte). */
export const TOTAIS_DO_MES = [CHAVES.resumoMes] as const;
