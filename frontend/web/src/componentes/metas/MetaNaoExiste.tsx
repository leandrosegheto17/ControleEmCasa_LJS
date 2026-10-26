import { LINK_METAS } from '../../formatacao/linksApp';
import { BotaoLink } from '../base/BotaoLink';
import { EstadoVazio } from '../base/EstadoVazio';

/** Um só texto para a meta inexistente e para a de outro membro: a tela não os distingue. */
export function MetaNaoExiste() {
  return (
    <EstadoVazio
      icone="busca"
      titulo="Esta meta não existe mais"
      texto="Ela pode ter sido excluída."
      papel="alert"
      acao={
        <BotaoLink para={LINK_METAS} variante="secundario">
          Voltar para Metas
        </BotaoLink>
      }
    />
  );
}
