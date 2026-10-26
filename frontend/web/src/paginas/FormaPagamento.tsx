import { useParams } from 'react-router';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ehUuid } from '../comum/uuid';
import { useForma } from '../ganchos/useFormasPagamento';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { EdicaoForma } from './forma/EdicaoForma';
import { NovaForma } from './forma/NovaForma';

const LISTA = '/app/ajustes/formas';

function FormaExistente({ id }: { id: string }) {
  const consulta = useForma(id);
  const leitura = useLeituraComCache(consulta);
  const sumiu =
    consulta.data === undefined && consulta.error?.tipo === 'regra' && consulta.error.codigo === 'registro_invalido';
  if (sumiu) return <FormaInexistente />;
  return (
    <EstadosDeLeitura
      leitura={leitura}
      esqueleto={<EsqueletoLista linhas={3} />}
      aoTentarDeNovo={() => void consulta.refetch()}
    >
      {(forma) => <EdicaoForma forma={forma} />}
    </EstadosDeLeitura>
  );
}

function FormaInexistente() {
  return (
    <EstadoVazio
      icone="cartao"
      titulo="Esta forma de pagamento não existe mais"
      acao={
        <BotaoLink para={LISTA} variante="secundario">
          Voltar para Formas de pagamento
        </BotaoLink>
      }
    />
  );
}

export function FormaPagamento() {
  const { id } = useParams();
  return (
    <>
      <CabecalhoPagina
        titulo={id ? 'Forma de pagamento' : 'Nova forma'}
        voltarPara={LISTA}
        rotuloVoltar="Voltar para Formas de pagamento"
      />
      <main>{id === undefined ? <NovaForma /> : ehUuid(id) ? <FormaExistente id={id} /> : <FormaInexistente />}</main>
    </>
  );
}
