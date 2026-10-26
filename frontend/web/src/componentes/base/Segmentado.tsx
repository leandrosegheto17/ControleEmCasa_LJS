import { useId } from 'react';
import estilo from './Segmentado.module.css';

export interface OpcaoSegmentado {
  valor: string;
  rotulo: string;
  desabilitada?: boolean;
}

interface Props {
  /** Nome do grupo para tecnologia assistiva; não aparece na tela. */
  legenda: string;
  /** `name` dos rádios nativos (as setas do teclado trocam a opção). */
  nome: string;
  opcoes: OpcaoSegmentado[];
  valor: string;
  aoMudar: (valor: string) => void;
  /** Mostra a legenda acima das opções, em vez de só para tecnologia assistiva. */
  legendaVisivel?: boolean;
  /** Texto de ajuda abaixo das opções, ligado ao grupo. */
  ajuda?: string;
}

/** Escolha de uma opção entre poucas, em rádios nativos. */
export function Segmentado({ legenda, nome, opcoes, valor, aoMudar, legendaVisivel, ajuda }: Props) {
  const idAjuda = `${useId()}-ajuda`;
  const rotulos = opcoes.map((opcao) => (
    <label key={opcao.valor}>
      <input
        type="radio"
        name={nome}
        value={opcao.valor}
        checked={opcao.valor === valor}
        disabled={opcao.desabilitada}
        onChange={() => aoMudar(opcao.valor)}
      />
      <span>{opcao.rotulo}</span>
    </label>
  ));

  if (!legendaVisivel && !ajuda) {
    return (
      <fieldset className={estilo.segmentado}>
        <legend className="visualmente-oculto">{legenda}</legend>
        {rotulos}
      </fieldset>
    );
  }

  return (
    <fieldset className={estilo.grupo} aria-describedby={ajuda ? idAjuda : undefined}>
      <legend className={legendaVisivel ? estilo.legenda : 'visualmente-oculto'}>{legenda}</legend>
      <div className={estilo.segmentado}>{rotulos}</div>
      {ajuda ? (
        <p id={idAjuda} className={estilo.ajuda}>
          {ajuda}
        </p>
      ) : null}
    </fieldset>
  );
}
