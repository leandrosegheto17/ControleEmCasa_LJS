import type { SaidaOrcamentoMes } from '@controle/contrato';

/** Uma categoria com orçamento no mês, como a API a devolve. */
export type LinhaOrcamentoMes = SaidaOrcamentoMes['linhas'][number];
/** Categoria de despesa do escopo que ainda não tem valor definido no mês. */
export type CategoriaSemOrcamento = SaidaOrcamentoMes['sem_orcamento'][number];
