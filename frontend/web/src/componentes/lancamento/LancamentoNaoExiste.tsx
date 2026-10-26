import { BotaoLink } from '../base/BotaoLink';
import { EstadoVazio } from '../base/EstadoVazio';

/** Um só texto para o lançamento inexistente e para o de outra casa: a tela não os distingue. */
export function LancamentoNaoExiste() {
  return (
    <EstadoVazio
      icone="busca"
      titulo="Este lançamento não existe mais"
      texto="Ele pode ter sido excluído."
      papel="alert"
      acao={
        <BotaoLink para="/app/lancamentos" variante="secundario">
          Voltar para Lançamentos
        </BotaoLink>
      }
    />
  );
}
