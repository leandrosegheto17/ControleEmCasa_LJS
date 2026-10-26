import type { SaidaOrcamentoMes as OrcamentoMes } from '@controle/contrato';
import type { EscopoUrl } from '../../formatacao/escopoUrl';
import { formatarMoeda, formatarRealizadoDeOrcado } from '../../formatacao/moeda';
import { BarraProgresso } from '../base/BarraProgresso';
import { CartaoResumo } from '../base/CartaoResumo';
import { SeloSituacao } from '../base/SeloSituacao';
import { LinhasValores } from '../inicio/LinhasValores';

type Total = NonNullable<OrcamentoMes['total']>;

const TEXTOS = {
  casa: { titulo: 'Orçamento da casa', resultado: 'Resultado da casa' },
  eu: { titulo: 'Meu orçamento', resultado: 'Meu resultado' },
} as const satisfies Record<EscopoUrl, { titulo: string; resultado: string }>;

interface Props {
  escopo: EscopoUrl;
  total: Total;
}

/** Total do mês no escopo: selo, "realizado de orçado", barra e o resultado, todos como a API entregou. */
export function CartaoTotalOrcamento({ escopo, total }: Props) {
  const { titulo, resultado } = TEXTOS[escopo];
  return (
    <CartaoResumo
      secao
      total
      bloco={escopo}
      estado="dado"
      textoVazio=""
      titulo={
        <>
          {titulo} <SeloSituacao situacao={total.situacao} />
        </>
      }
    >
      <BarraProgresso
        rotulo={titulo}
        percentual={total.percentual}
        situacao={total.situacao}
        topo={
          <>
            <span className="valor">{formatarRealizadoDeOrcado(total.realizado_centavos, total.orcado_centavos)}</span>
            <span className="valor">{total.percentual}%</span>
          </>
        }
      />
      <LinhasValores
        linhas={[
          {
            rotulo: resultado,
            valor: formatarMoeda(total.resultado_centavos),
            parcial: total.parcial,
          },
        ]}
      />
    </CartaoResumo>
  );
}
