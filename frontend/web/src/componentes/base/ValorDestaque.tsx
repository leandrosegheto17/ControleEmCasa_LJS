import { formatarMoeda } from '../../formatacao/moeda';
import { RotuloParcial } from './RotuloParcial';
import estilos from './ValorDestaque.module.css';

interface Props {
  centavos: number;
  parcial?: boolean;
  /** Texto do selo ao lado do valor, no lugar de "parcial" (ex.: "parcela 2 de 3"). */
  rotulo?: string;
}

/** Valor grande de um cartão; `parcial` marca total de mês ainda aberto. */
export function ValorDestaque({ centavos, parcial = false, rotulo }: Props) {
  return (
    <div className={estilos['linha-destaque']}>
      <p className={estilos['valor-destaque']}>{formatarMoeda(centavos)}</p>
      {rotulo ? <RotuloParcial>{rotulo}</RotuloParcial> : parcial ? <RotuloParcial /> : null}
    </div>
  );
}
