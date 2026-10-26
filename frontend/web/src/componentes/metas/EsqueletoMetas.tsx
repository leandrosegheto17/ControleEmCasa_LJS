import { Bloco } from '../Bloco';
import { CartaoResumo } from '../base/CartaoResumo';

const FORMA = ['titulo', 'linha', 'linha-curta'] as const;

function Cartoes({ bloco, quantidade }: { bloco: 'casa' | 'eu'; quantidade: number }) {
  return (
    <>
      {Array.from({ length: quantidade }, (_, i) => (
        <CartaoResumo key={i} titulo="" bloco={bloco} estado="carregando" textoVazio="" formaEsqueleto={FORMA} />
      ))}
    </>
  );
}

/** Forma da lista de metas enquanto ela não chega: dois cartões da casa e um do membro. */
export function EsqueletoMetas() {
  return (
    <>
      <Bloco bloco="casa" titulo="Da casa" colunas={2} carregando>
        <Cartoes bloco="casa" quantidade={2} />
      </Bloco>
      <Bloco bloco="eu" titulo="Minhas" colunas={2} carregando>
        <Cartoes bloco="eu" quantidade={1} />
      </Bloco>
    </>
  );
}
