import type { TipoForma } from '../comum/enums';
import type { Exaustiva } from './exaustividade';

export const ROTULO_TIPO_FORMA = {
  pix: { texto: 'Pix' },
  debito: { texto: 'Débito' },
  credito: { texto: 'Crédito' },
} as const satisfies Record<TipoForma, { texto: string; icone?: string }>;

const ordem = ['pix', 'debito', 'credito'] as const;
export const ORDEM_TIPO_FORMA: Exaustiva<TipoForma, typeof ordem> = ordem;
