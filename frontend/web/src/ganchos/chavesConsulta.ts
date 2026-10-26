/** Chaves do cache de consulta, num só lugar: leitura e invalidação usam as mesmas. */
export const CHAVES = {
  contas: ['contas'],
  conta: (id: string) => ['contas', id],
  formas: ['formas'],
  forma: (id: string) => ['formas', id],
  categorias: ['categorias'],
  categoria: (id: string) => ['categorias', id],
  /** Resumo do mês (etapa 12, lote 2): o pagamento do cartão mexe nele. */
  resumoMes: ['resumo'],
} as const;
