import { linkMeta } from '../../formatacao/linksApp';
import { CartaoMetas } from '../CartaoMetas';
import type { PropsEu } from './tipos';

export function EuMetas({ individual }: PropsEu) {
  return (
    <CartaoMetas
      titulo="Minhas metas"
      bloco="eu"
      metas={individual.metas}
      linkMeta={(id) => linkMeta(id)}
      textoVazio="Nenhuma meta ainda."
      linkNova="/app/metas/nova"
    />
  );
}
