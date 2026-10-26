import type { SituacaoOrcamento } from '../comum/enums';
import type { Exaustiva } from './exaustividade';

export const ROTULO_SITUACAO_ORCAMENTO = {
  dentro: { texto: 'Dentro', icone: 'ok' },
  atencao: { texto: 'Atenção', icone: 'aviso' },
  estourado: { texto: 'Estourado', icone: 'alerta' },
} as const satisfies Record<SituacaoOrcamento, { texto: string; icone: string }>;

const ordem = ['estourado', 'atencao', 'dentro'] as const;
export const ORDEM_SITUACAO_ORCAMENTO: Exaustiva<SituacaoOrcamento, typeof ordem> = ordem;
