import { SeloSituacao } from '../base/SeloSituacao';
import estilos from './TopoMeta.module.css';

interface Props {
  nome: string;
  percentual: number;
  atingida: boolean;
}

/** Linha de cima da meta: o nome e, à direita, o percentual ou o selo "Atingida". */
export function TopoMeta({ nome, percentual, atingida }: Props) {
  return (
    <>
      <span className={estilos['item-titulo']}>{nome}</span>
      {atingida ? <SeloSituacao situacao="atingida" /> : <span className="valor">{percentual}%</span>}
    </>
  );
}
