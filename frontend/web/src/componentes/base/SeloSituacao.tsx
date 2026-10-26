import type { SituacaoOcorrencia, SituacaoOrcamento } from '../../comum/enums';
import { ROTULO_SITUACAO_OCORRENCIA } from '../../rotulos/situacaoOcorrencia';
import { ROTULO_SITUACAO_ORCAMENTO } from '../../rotulos/situacaoOrcamento';
import type { NomeIcone } from './Icone';
import { SeloBase } from './SeloBase';

export type SituacaoSelo = SituacaoOcorrencia | SituacaoOrcamento | 'ajustada' | 'atingida' | 'aguardando' | 'variavel';

interface Visual {
  classe: string;
  texto: string;
  icone?: NomeIcone;
}

// Situações que não vêm de uma união do contrato.
const EXTRAS: Record<'ajustada' | 'atingida' | 'aguardando' | 'variavel', Visual> = {
  ajustada: { classe: 'selo-ajustada', texto: 'data ajustada', icone: 'calendario' },
  atingida: { classe: 'selo-dentro', texto: 'Atingida', icone: 'ok' },
  aguardando: { classe: 'selo-aguardando', texto: 'aguardando envio', icone: 'envio' },
  variavel: { classe: 'selo-variavel', texto: 'variável' },
};

function visualDe(situacao: SituacaoSelo): Visual {
  if (situacao in ROTULO_SITUACAO_OCORRENCIA) {
    const r = ROTULO_SITUACAO_OCORRENCIA[situacao as SituacaoOcorrencia];
    return { classe: `selo-${situacao}`, texto: r.texto, icone: r.icone as NomeIcone };
  }
  if (situacao in ROTULO_SITUACAO_ORCAMENTO) {
    const r = ROTULO_SITUACAO_ORCAMENTO[situacao as SituacaoOrcamento];
    return { classe: `selo-${situacao}`, texto: r.texto, icone: r.icone as NomeIcone };
  }
  return EXTRAS[situacao as keyof typeof EXTRAS];
}

interface Props {
  situacao: SituacaoSelo;
  /** Substitui o texto padrão (ex.: "Paga por Ana"); classe e ícone não mudam. */
  texto?: string;
}

export function SeloSituacao({ situacao, texto }: Props) {
  const v = visualDe(situacao);
  return (
    <SeloBase classes={[v.classe]} icone={v.icone}>
      {texto ?? v.texto}
    </SeloBase>
  );
}
