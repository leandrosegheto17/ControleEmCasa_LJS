import { Botao } from '../base/Botao';
import { EstadoVazio } from '../base/EstadoVazio';

interface Props {
  texto: string;
  aoLimpar: () => void;
}

/** Lista vazia com filtro ativo: explica e oferece tirar os filtros. */
export function VazioFiltrado({ texto, aoLimpar }: Props) {
  return (
    <EstadoVazio
      icone="busca"
      titulo="Nenhum lançamento com esses filtros"
      texto={texto}
      acao={
        <Botao variante="secundario" onClick={aoLimpar}>
          Limpar filtros
        </Botao>
      }
    />
  );
}
