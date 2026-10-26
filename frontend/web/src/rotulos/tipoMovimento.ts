import type { TipoMovimentoMeta } from '../comum/enums';
import type { Exaustiva } from './exaustividade';

export const ROTULO_TIPO_MOVIMENTO = {
  aporte: { texto: 'Aporte' },
  retirada: { texto: 'Retirada' },
} as const satisfies Record<TipoMovimentoMeta, { texto: string; icone?: string }>;

const ordem = ['aporte', 'retirada'] as const;
export const ORDEM_TIPO_MOVIMENTO: Exaustiva<TipoMovimentoMeta, typeof ordem> = ordem;
