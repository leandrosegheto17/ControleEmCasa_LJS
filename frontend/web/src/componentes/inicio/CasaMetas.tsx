import { linkMeta } from '../../formatacao/linksApp';
import { CartaoMetas } from '../CartaoMetas';
import type { PropsCasa } from './tipos';

export function CasaMetas({ conjunto }: PropsCasa) {
  return (
    <CartaoMetas
      titulo="Metas da casa"
      bloco="casa"
      metas={conjunto.metas}
      linkMeta={(id) => linkMeta(id)}
      textoVazio="Nenhuma meta da casa."
      linkNova="/app/metas/nova"
    />
  );
}
