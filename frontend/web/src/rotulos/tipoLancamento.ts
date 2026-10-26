import type { TipoLancamento } from '../comum/enums';
import type { Exaustiva } from './exaustividade';

export const ROTULO_TIPO_LANCAMENTO = {
  despesa: { texto: 'Despesa', plural: 'Despesas' },
  receita: { texto: 'Receita', plural: 'Receitas' },
} as const satisfies Record<TipoLancamento, { texto: string; plural: string }>;

const ordem = ['despesa', 'receita'] as const;
export const ORDEM_TIPO_LANCAMENTO: Exaustiva<TipoLancamento, typeof ordem> = ordem;
