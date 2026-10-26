import { useId, type ReactNode, type Ref } from 'react';
import { Esqueleto, type VarianteEsqueleto } from './Esqueleto';
import { LinhaVazia } from './LinhaVazia';
import estilos from './CartaoResumo.module.css';

interface Props {
  titulo: ReactNode;
  total?: boolean;
  /** `section` com `h2` quando o cartão é uma seção da tela e não um item de grade (`article` com `h3`). */
  secao?: boolean;
  /** Cor da borda do topo (o bloco em si é da tela); sem ele o cartão não tem destaque. */
  bloco?: 'casa' | 'eu';
  estado: 'dado' | 'vazio' | 'carregando';
  textoVazio: string;
  acaoVazio?: ReactNode;
  /** Peças do esqueleto no estado `carregando`; o padrão é título, valor e duas linhas. */
  formaEsqueleto?: readonly VarianteEsqueleto[];
  /** Permite levar o foco ao título (ganha `tabIndex=-1`). */
  refTitulo?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}

const FORMA_PADRAO: readonly VarianteEsqueleto[] = ['titulo', 'valor', 'linha', 'linha-curta'];

/** Cartão de resumo com os três estados: dado, vazio e carregando. */
export function CartaoResumo({
  titulo,
  total = false,
  secao = false,
  bloco,
  estado,
  textoVazio,
  acaoVazio,
  formaEsqueleto = FORMA_PADRAO,
  refTitulo,
  children,
}: Props) {
  const idTitulo = useId();
  const classes = [estilos.cartao, bloco ? estilos[bloco] : '', total ? estilos['cartao-total'] : '']
    .filter(Boolean)
    .join(' ');

  const Raiz = secao ? 'section' : 'article';
  const Titulo = secao ? 'h2' : 'h3';

  if (estado === 'carregando') {
    return (
      <Raiz className={classes} aria-hidden="true">
        {formaEsqueleto.map((variante, i) => (
          <Esqueleto key={i} variante={variante} />
        ))}
      </Raiz>
    );
  }

  return (
    <Raiz className={classes} aria-labelledby={idTitulo}>
      <Titulo id={idTitulo} ref={refTitulo} tabIndex={refTitulo ? -1 : undefined}>
        {titulo}
      </Titulo>
      {estado === 'vazio' ? (
        <>
          <LinhaVazia>{textoVazio}</LinhaVazia>
          {acaoVazio}
        </>
      ) : (
        children
      )}
    </Raiz>
  );
}
