import { Link } from 'react-router';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { formatarMoeda } from '../../formatacao/moeda';
import lista from '../base/Lista.module.css';
import { SeloSituacao } from '../base/SeloSituacao';
import estilos from './ListaPorCategoria.module.css';

type TotalPorCategoria = ResumoMes['conjunto']['por_categoria'][number];

interface Props {
  itens: readonly TotalPorCategoria[];
  /** Destino do item; a lista não sabe de escopo nem de mês. */
  linkPara: (categoriaId: string) => string;
}

/** Totais por categoria na ordem recebida, cada um levando aos lançamentos filtrados. */
export function ListaPorCategoria({ itens, linkPara }: Props) {
  return (
    <ul className={lista.lista}>
      {itens.map((item) => (
        <li key={item.categoria_id}>
          <Link to={linkPara(item.categoria_id)} className={`${lista.link} ${estilos['item-link']}`}>
            {item.variavel ? (
              <span className={estilos['item-info']}>
                <span className={estilos['item-titulo']}>{item.nome}</span>
                <span className={estilos['item-sub']}>
                  <SeloSituacao situacao="variavel" />
                </span>
              </span>
            ) : (
              <span className={estilos['item-titulo']}>{item.nome}</span>
            )}
            <span className="valor">{formatarMoeda(item.total_centavos)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
