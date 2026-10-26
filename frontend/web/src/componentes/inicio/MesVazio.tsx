import { formatarNomeMes } from '../../formatacao/mes';
import { BotaoLink } from '../base/BotaoLink';
import { LinhaVazia } from '../base/LinhaVazia';

interface Props {
  /** 'AAAA-MM' */
  mes: string;
}

/** Conteúdo do total do casal quando o mês não tem lançamentos. */
export function MesVazio({ mes }: Props) {
  return (
    <>
      <LinhaVazia>Nada lançado em {formatarNomeMes(mes)} ainda.</LinhaVazia>
      <BotaoLink para="/app/lancar" variante="secundario" icone="mais">
        Lançar
      </BotaoLink>
    </>
  );
}
