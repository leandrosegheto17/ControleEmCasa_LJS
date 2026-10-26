import type { CSSProperties, ReactNode } from 'react';
import type { SituacaoOrcamento } from '../../comum/enums';
import estilos from './BarraProgresso.module.css';

export type SituacaoBarra = SituacaoOrcamento | 'atingida' | 'casa' | 'eu';

const CLASSE_POR_SITUACAO = {
  dentro: 'barra-dentro',
  atencao: 'barra-atencao',
  estourado: 'barra-estourado',
  atingida: 'barra-dentro',
  casa: 'barra-casa',
  eu: 'barra-eu',
} as const satisfies Record<SituacaoBarra, string>;

interface Props {
  /** Percentual vindo da API; pode passar de 100. */
  percentual: number;
  situacao: SituacaoBarra;
  /** Nome acessível da barra. */
  rotulo: string;
  /** Texto sempre visível acima da barra ("56%", "R$ X de R$ Y"); sem ele o valor está no texto ao redor. */
  topo?: ReactNode;
  topoSecundario?: ReactNode;
  /** Onde o `topoSecundario` entra: antes da barra (padrão) ou logo abaixo dela. */
  posicaoSecundario?: 'antes' | 'depois';
  /** `span` quando a barra fica dentro de um link. */
  elemento?: 'div' | 'span';
  /** Barra só ilustrativa: o texto ao redor já diz o valor. */
  decorativa?: boolean;
}

/** Barra de progresso; a largura para em 100%, o `aria-valuenow` mantém o valor real. */
export function BarraProgresso({
  percentual,
  situacao,
  rotulo,
  topo,
  topoSecundario,
  posicaoSecundario = 'antes',
  elemento: Elemento = 'div',
  decorativa = false,
}: Props) {
  const largura = { '--p': `${Math.min(percentual, 100)}%` } as CSSProperties;
  const acessibilidade = decorativa
    ? { 'aria-hidden': true as const }
    : {
        role: 'progressbar',
        'aria-label': rotulo,
        'aria-valuenow': percentual,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
      };

  const depois = posicaoSecundario === 'depois';
  const secundario = topoSecundario ? (
    <div className={`${estilos['orc-topo']} ${estilos['item-sub']}`}>{topoSecundario}</div>
  ) : null;

  return (
    <>
      {topo ? <div className={estilos['orc-topo']}>{topo}</div> : null}
      {depois ? null : secundario}
      <Elemento className={`${estilos.barra} ${estilos[CLASSE_POR_SITUACAO[situacao]]}`} {...acessibilidade}>
        <span style={largura} />
      </Elemento>
      {depois ? secundario : null}
    </>
  );
}
