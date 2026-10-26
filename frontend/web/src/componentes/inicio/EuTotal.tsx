import { formatarMoeda } from '../../formatacao/moeda';
import { CartaoResumo } from '../base/CartaoResumo';
import { ValorDestaque } from '../base/ValorDestaque';
import { LinhasValores } from './LinhasValores';
import type { PropsEu } from './tipos';

interface Props extends PropsEu {
  mesVazio: boolean;
}

export function EuTotal({ individual, mesVazio }: Props) {
  const linhas = [
    { rotulo: 'Minha parte na casa', valor: formatarMoeda(individual.minha_parte_conjunto_centavos) },
    { rotulo: 'Meu individual', valor: formatarMoeda(individual.meu_individual_centavos) },
    ...(mesVazio ? [] : [{ rotulo: 'Variáveis', valor: formatarMoeda(individual.total_variaveis_centavos) }]),
  ];
  return (
    <CartaoResumo titulo="Meu total" total bloco="eu" estado="dado" textoVazio="">
      <ValorDestaque centavos={individual.meu_total_centavos} parcial={individual.resultado.parcial} />
      <LinhasValores linhas={linhas} />
    </CartaoResumo>
  );
}
