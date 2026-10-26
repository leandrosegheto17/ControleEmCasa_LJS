import type { VarianteEsqueleto } from '../base/Esqueleto';
import { CartaoResumo } from '../base/CartaoResumo';
import { Bloco } from '../Bloco';

const CASA: VarianteEsqueleto[][] = [
  ['titulo', 'valor', 'linha', 'linha-curta'],
  ['titulo', 'linha', 'linha'],
  ['titulo', 'linha', 'linha', 'linha-curta'],
];
const EU: VarianteEsqueleto[][] = [
  ['titulo', 'valor', 'linha', 'linha-curta'],
  ['titulo', 'linha', 'linha'],
  ['titulo', 'linha', 'linha-curta'],
];

function Cartoes({ bloco, formas }: { bloco: 'casa' | 'eu'; formas: VarianteEsqueleto[][] }) {
  return (
    <>
      {formas.map((forma, i) => (
        <CartaoResumo key={i} titulo="" bloco={bloco} estado="carregando" textoVazio="" formaEsqueleto={forma} />
      ))}
    </>
  );
}

/** Forma da Início enquanto o resumo do mês não chega: dois blocos de três cartões. */
export function EsqueletoInicio({ nome }: { nome?: string }) {
  return (
    <>
      <Bloco bloco="casa" titulo="Casa" carregando>
        <Cartoes bloco="casa" formas={CASA} />
      </Bloco>
      <Bloco bloco="eu" titulo="Eu" nome={nome} carregando>
        <Cartoes bloco="eu" formas={EU} />
      </Bloco>
    </>
  );
}
