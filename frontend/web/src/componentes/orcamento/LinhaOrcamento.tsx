import { Link } from 'react-router';
import type { SituacaoOrcamento } from '../../comum/enums';
import { formatarRealizadoDeOrcado } from '../../formatacao/moeda';
import { BarraProgresso } from '../base/BarraProgresso';
import { SeloSituacao } from '../base/SeloSituacao';
import estilos from './LinhaOrcamento.module.css';

interface Props {
  nome: string;
  orcadoCentavos: number;
  realizadoCentavos: number;
  percentual: number;
  situacao: SituacaoOrcamento;
  /** Com destino, a linha inteira vira link e a barra deixa de ser um elemento de bloco solto. */
  href?: string;
  /** Nome acessível do link (obrigatório com `href`). */
  rotuloLink?: string;
  /** Primeira linha de um cartão: sem a divisória de cima. */
  primeira?: boolean;
}

/** Nome e selo, "realizado de orçado" com o percentual, e a barra de uma categoria. */
export function LinhaOrcamento({
  nome,
  orcadoCentavos,
  realizadoCentavos,
  percentual,
  situacao,
  href,
  rotuloLink,
  primeira,
}: Props) {
  const barra = (
    <BarraProgresso
      rotulo={nome}
      percentual={percentual}
      situacao={situacao}
      elemento={href ? 'span' : 'div'}
      topo={
        <>
          <span className={estilos['item-titulo']}>{nome}</span>
          <SeloSituacao situacao={situacao} />
        </>
      }
      topoSecundario={
        <>
          <span className="valor">{formatarRealizadoDeOrcado(realizadoCentavos, orcadoCentavos)}</span>
          <span className="valor">{percentual}%</span>
        </>
      }
    />
  );

  return (
    <div className={`${estilos['orc-linha']}${primeira ? ` ${estilos.primeira}` : ''}`}>
      {href ? (
        <Link to={href} className={estilos['orc-linha-link']} aria-label={rotuloLink}>
          {barra}
        </Link>
      ) : (
        barra
      )}
    </div>
  );
}
