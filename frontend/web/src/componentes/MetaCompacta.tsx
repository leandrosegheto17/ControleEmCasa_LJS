import { Link } from 'react-router';
import type { SaidaResumoMes } from '@controle/contrato';

type ResumoMeta = SaidaResumoMes['conjunto']['metas'][number];
import { situacaoBarraMeta, textoPrazoMeta } from '../formatacao/metas';
import { formatarMoeda } from '../formatacao/moeda';
import { BarraProgresso } from './base/BarraProgresso';
import { TopoMeta } from './metas/TopoMeta';
import estilos from './MetaCompacta.module.css';

interface Props {
  meta: ResumoMeta;
  bloco: 'casa' | 'eu';
  href: string;
}

/** Meta em uma linha de cartão: nome, progresso, quanto falta e, se houver prazo, o ritmo mensal. */
export function MetaCompacta({ meta, bloco, href }: Props) {
  const mensal = meta.mensal_necessario_centavos;

  return (
    <Link to={href} className={`${estilos.meta} ${estilos['meta-link']}`}>
      <BarraProgresso
        elemento="span"
        rotulo={meta.nome}
        percentual={meta.percentual}
        situacao={situacaoBarraMeta(meta.atingida, bloco)}
        topo={<TopoMeta nome={meta.nome} percentual={meta.percentual} atingida={meta.atingida} />}
        posicaoSecundario="depois"
        topoSecundario={
          <>
            <span className="valor">
              {formatarMoeda(meta.guardado_centavos)} de {formatarMoeda(meta.alvo_centavos)}
            </span>
            <span className="valor">faltam {formatarMoeda(meta.falta_centavos)}</span>
          </>
        }
      />
      {meta.prazo !== null && mensal !== null ? (
        <span className={estilos['item-sub']}>
          {textoPrazoMeta({ prazo: meta.prazo, mensal_necessario_centavos: mensal })}
        </span>
      ) : null}
    </Link>
  );
}
