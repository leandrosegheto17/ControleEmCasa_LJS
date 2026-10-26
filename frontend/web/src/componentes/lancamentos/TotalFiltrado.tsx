import { formatarMoeda } from '../../formatacao/moeda';
import estilos from './TotalFiltrado.module.css';

interface Props {
  /** Total e quantidade vêm da API; a tela não soma. */
  totalCentavos: number;
  quantidade: number;
}

/** Faixa fixa no topo da rolagem; a região viva só anuncia quando o texto muda. */
export function TotalFiltrado({ totalCentavos, quantidade }: Props) {
  return (
    <div className={estilos['total-filtrado']} aria-live="polite">
      <span>
        Total filtrado{' '}
        <span className="texto-2 pequeno">· {quantidade === 1 ? '1 lançamento' : `${quantidade} lançamentos`}</span>
      </span>
      <span className={`valor ${estilos.valor}`}>{formatarMoeda(totalCentavos)}</span>
    </div>
  );
}
