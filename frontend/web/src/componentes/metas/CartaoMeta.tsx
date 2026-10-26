import { Link } from 'react-router';
import type { SaidaLinhaMetas as LinhaMetas } from '@controle/contrato';
import { linkMeta } from '../../formatacao/linksApp';
import { situacaoBarraMeta, textoPrazoMeta } from '../../formatacao/metas';
import { formatarMoeda } from '../../formatacao/moeda';
import { BarraProgresso } from '../base/BarraProgresso';
import estilos from './CartaoMeta.module.css';
import { TopoMeta } from './TopoMeta';

interface Props {
  meta: LinhaMetas;
  bloco: 'casa' | 'eu';
}

/** Última linha: o percentual quando já foi atingida, senão o prazo com o valor mensal ou "Sem prazo". */
function complemento(meta: LinhaMetas): string {
  if (meta.atingida) return `${meta.percentual}%`;
  const { prazo, mensal_necessario_centavos } = meta;
  if (prazo === null) return 'Sem prazo';
  return textoPrazoMeta({ prazo, mensal_necessario_centavos }, { maiuscula: true });
}

/** Cartão da lista de metas; todos os números vêm da API. */
export function CartaoMeta({ meta, bloco }: Props) {
  return (
    <Link to={linkMeta(meta.id)} className={`${estilos.cartao} ${estilos[bloco]}`}>
      <BarraProgresso
        elemento="span"
        rotulo={meta.nome}
        percentual={meta.percentual}
        situacao={situacaoBarraMeta(meta.atingida, bloco)}
        topo={<TopoMeta nome={meta.nome} percentual={meta.percentual} atingida={meta.atingida} />}
      />
      <span className={estilos.guardado}>
        <span className="valor">
          Guardado {formatarMoeda(meta.guardado_centavos)} de {formatarMoeda(meta.alvo_centavos)}
        </span>
      </span>
      <span className={`valor ${estilos.falta}`}>Faltam {formatarMoeda(meta.falta_centavos)}</span>
      <span className={estilos.complemento}>{complemento(meta)}</span>
    </Link>
  );
}
