import { linkConta } from '../../formatacao/linksApp';
import { formatarMoeda } from '../../formatacao/moeda';
import { CartaoResumo } from '../base/CartaoResumo';
import { ItemLink } from '../base/ItemLink';
import estilos from '../base/Lista.module.css';
import { LinkMais } from '../base/LinkMais';
import type { PropsEu } from './tipos';

export function EuContas({ individual }: PropsEu) {
  const { contas } = individual;
  return (
    <CartaoResumo
      titulo="Contas"
      bloco="eu"
      estado={contas.length === 0 ? 'vazio' : 'dado'}
      textoVazio="Nenhuma conta cadastrada."
      acaoVazio={
        <LinkMais seta para="/app/ajustes/contas/nova">
          Cadastrar conta
        </LinkMais>
      }
    >
      <ul className={estilos.lista}>
        {contas.map((c) => (
          <ItemLink
            key={c.conta_id}
            icone="banco"
            rotulo={c.nome}
            valor={formatarMoeda(c.saldo_centavos)}
            para={linkConta(c.conta_id)}
          />
        ))}
      </ul>
    </CartaoResumo>
  );
}
