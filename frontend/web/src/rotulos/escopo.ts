import type { Escopo } from '../comum/enums';
import type { Exaustiva } from './exaustividade';

export const ROTULO_ESCOPO = {
  conjunto: { texto: 'Casa', icone: 'casa', grupo: 'Da casa', lista: 'Casa' },
  individual: { texto: 'Eu', icone: 'pessoa', grupo: 'Minhas', lista: 'Minhas' },
} as const satisfies Record<Escopo, { texto: string; icone: string; grupo: string; lista: string }>;

const ordem = ['conjunto', 'individual'] as const;
export const ORDEM_ESCOPO: Exaustiva<Escopo, typeof ordem> = ordem;
