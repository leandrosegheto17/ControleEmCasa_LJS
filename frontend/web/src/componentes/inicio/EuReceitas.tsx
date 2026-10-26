import { formatarMoeda } from '../../formatacao/moeda';
import { CartaoResumo } from '../base/CartaoResumo';
import { RotuloParcial } from '../base/RotuloParcial';
import { LinhasValores } from './LinhasValores';
import type { PropsEu } from './tipos';

export function EuReceitas({ individual }: PropsEu) {
  const { resultado } = individual;
  return (
    <CartaoResumo
      titulo={<>Receitas e resultado {resultado.parcial ? <RotuloParcial /> : null}</>}
      bloco="eu"
      estado="dado"
      textoVazio=""
    >
      <LinhasValores
        linhas={[
          { rotulo: 'Receitas', valor: formatarMoeda(individual.receitas_centavos), receita: true },
          { rotulo: 'Meu total', valor: `− ${formatarMoeda(individual.meu_total_centavos)}` },
          { rotulo: 'Resultado', valor: formatarMoeda(resultado.valor_centavos) },
          { rotulo: 'Guardado no mês', valor: formatarMoeda(individual.guardado_no_mes_centavos) },
        ]}
      />
    </CartaoResumo>
  );
}
