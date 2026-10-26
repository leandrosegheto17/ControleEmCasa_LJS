import { ROTULO_ESCOPO } from '../../rotulos/escopo';
import type { Escopo } from '../../comum/enums';
import type { NomeIcone } from './Icone';
import { SeloBase } from './SeloBase';

interface Props {
  escopo: Escopo;
  /** Substitui o texto padrão (ex.: "Da casa"); o ícone não muda. */
  texto?: string;
}

const CLASSE: Record<Escopo, string> = { conjunto: 'casa', individual: 'eu' };

export function SeloEscopo({ escopo, texto }: Props) {
  const rotulo = ROTULO_ESCOPO[escopo];
  return (
    <SeloBase classes={['selo-escopo', CLASSE[escopo]]} icone={rotulo.icone as NomeIcone}>
      {texto ?? rotulo.texto}
    </SeloBase>
  );
}
