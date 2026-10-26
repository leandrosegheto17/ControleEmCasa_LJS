import type { ReactNode } from 'react';
import type { SaidaResumoMes } from '@controle/contrato';

type DadosOrcamento = NonNullable<SaidaResumoMes['conjunto']['orcamento']>;
import { formatarRealizadoDeOrcado } from '../formatacao/moeda';
import { BarraProgresso } from './base/BarraProgresso';
import { CartaoResumo } from './base/CartaoResumo';
import { LinkMais } from './base/LinkMais';
import { SeloSituacao } from './base/SeloSituacao';
import { LinhaOrcamento } from './orcamento/LinhaOrcamento';

interface Props {
  titulo: string;
  bloco: 'casa' | 'eu';
  orcamento: DadosOrcamento | null;
  linkVer: string;
  textoVer: string;
  textoVazio: string;
  acaoVazio: ReactNode;
}

/** Cartão de orçamento do mês: total e os destaques que a API escolheu. */
export function ResumoOrcamento({ titulo, bloco, orcamento, linkVer, textoVer, textoVazio, acaoVazio }: Props) {
  if (orcamento === null) {
    return <CartaoResumo titulo={titulo} bloco={bloco} estado="vazio" textoVazio={textoVazio} acaoVazio={acaoVazio} />;
  }

  return (
    <CartaoResumo
      titulo={
        <>
          {titulo} <SeloSituacao situacao={orcamento.situacao} />
        </>
      }
      bloco={bloco}
      estado="dado"
      textoVazio={textoVazio}
    >
      <BarraProgresso
        rotulo={titulo}
        percentual={orcamento.percentual}
        situacao={orcamento.situacao}
        topo={
          <>
            <span className="valor">
              {formatarRealizadoDeOrcado(orcamento.realizado_centavos, orcamento.orcado_centavos)}
            </span>
            <span className="valor">{orcamento.percentual}%</span>
          </>
        }
      />
      {orcamento.destaques.map((d) => (
        <LinhaOrcamento
          key={d.categoria_id}
          nome={d.nome}
          orcadoCentavos={d.orcado_centavos}
          realizadoCentavos={d.realizado_centavos}
          percentual={d.percentual}
          situacao={d.situacao}
        />
      ))}
      <LinkMais seta para={linkVer}>
        {textoVer}
      </LinkMais>
    </CartaoResumo>
  );
}
