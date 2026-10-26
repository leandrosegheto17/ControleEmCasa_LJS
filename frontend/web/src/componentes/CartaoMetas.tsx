import type { SaidaResumoMes } from '@controle/contrato';

type ResumoMeta = SaidaResumoMes['conjunto']['metas'][number];
import { CartaoResumo } from './base/CartaoResumo';
import { LinkMais } from './base/LinkMais';
import { MetaCompacta } from './MetaCompacta';

interface Props {
  titulo: string;
  bloco: 'casa' | 'eu';
  metas: ResumoMeta[];
  linkMeta: (id: string) => string;
  textoVazio: string;
  linkNova: string;
}

/** Cartão com as metas do bloco; sem metas, a linha vazia e o atalho "Nova meta". */
export function CartaoMetas({ titulo, bloco, metas, linkMeta, textoVazio, linkNova }: Props) {
  return (
    <CartaoResumo
      titulo={titulo}
      bloco={bloco}
      estado={metas.length === 0 ? 'vazio' : 'dado'}
      textoVazio={textoVazio}
      acaoVazio={
        <LinkMais seta para={linkNova}>
          Nova meta
        </LinkMais>
      }
    >
      {metas.map((m) => (
        <MetaCompacta key={m.meta_id} meta={m} bloco={bloco} href={linkMeta(m.meta_id)} />
      ))}
    </CartaoResumo>
  );
}
