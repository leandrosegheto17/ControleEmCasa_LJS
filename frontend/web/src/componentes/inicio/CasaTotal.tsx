import type { ReactNode } from 'react';
import { formatarMoeda } from '../../formatacao/moeda';
import { CartaoResumo } from '../base/CartaoResumo';
import { ValorDestaque } from '../base/ValorDestaque';
import { LinhasValores } from './LinhasValores';
import type { PropsCasa } from './tipos';

interface Props extends PropsCasa {
  mesVazio: boolean;
  /** Entregue pelo conteúdo quando o mês não tem lançamentos. */
  rodapeVazio?: ReactNode;
}

export function CasaTotal({ conjunto, mesVazio, rodapeVazio }: Props) {
  return (
    <CartaoResumo titulo="Total do casal" total bloco="casa" estado="dado" textoVazio="">
      <ValorDestaque centavos={conjunto.total_centavos} parcial={conjunto.resultado.parcial} />
      {mesVazio ? (
        rodapeVazio
      ) : (
        <LinhasValores
          linhas={[
            { rotulo: 'Variáveis da casa', valor: formatarMoeda(conjunto.total_variaveis_centavos) },
            { rotulo: 'Previsto a pagar (fixas pendentes)', valor: formatarMoeda(conjunto.previsto_a_pagar_centavos) },
          ]}
        />
      )}
    </CartaoResumo>
  );
}
