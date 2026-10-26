import { linkOrcamento } from '../../formatacao/linksApp';
import { LinkMais } from '../base/LinkMais';
import { ResumoOrcamento } from '../ResumoOrcamento';
import type { PropsEu } from './tipos';

export function EuOrcamento({ individual, mes }: PropsEu) {
  const destino = linkOrcamento({ mes, escopo: 'individual' });
  return (
    <ResumoOrcamento
      titulo="Meu orçamento"
      bloco="eu"
      orcamento={individual.orcamento}
      linkVer={destino}
      textoVer="Ver meu orçamento"
      textoVazio="Sem orçamento no mês."
      acaoVazio={
        <LinkMais seta para={destino}>
          Definir orçamento
        </LinkMais>
      }
    />
  );
}
