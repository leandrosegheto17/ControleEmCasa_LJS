import type { SituacaoOcorrencia } from '../comum/enums';
import type { Exaustiva } from './exaustividade';

export const ROTULO_SITUACAO_OCORRENCIA = {
  pendente: { texto: 'Pendente', icone: 'relogio' },
  atrasada: { texto: 'Atrasada', icone: 'alerta' },
  paga: { texto: 'Paga', icone: 'ok' },
} as const satisfies Record<SituacaoOcorrencia, { texto: string; icone: string }>;

const ordem = ['atrasada', 'pendente', 'paga'] as const;
export const ORDEM_SITUACAO_OCORRENCIA: Exaustiva<SituacaoOcorrencia, typeof ordem> = ordem;
