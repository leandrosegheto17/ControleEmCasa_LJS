import { formatarMoeda } from '../../formatacao/moeda';
import { CartaoResumo } from '../base/CartaoResumo';
import { ValorDestaque } from '../base/ValorDestaque';
import saldo from '../base/Formula.module.css';
import type { PropsCasa } from './tipos';

export function CasaResultado({ conjunto }: PropsCasa) {
  const { resultado, orcamento, total_centavos } = conjunto;
  return (
    <CartaoResumo titulo="Resultado da casa" bloco="casa" estado="dado" textoVazio="">
      <ValorDestaque centavos={resultado.valor_centavos} parcial={resultado.parcial} />
      {orcamento ? (
        <p className={saldo.formula}>
          {`Orçamento ${formatarMoeda(orcamento.orcado_centavos)} − total ${formatarMoeda(total_centavos)}`}
        </p>
      ) : null}
    </CartaoResumo>
  );
}
