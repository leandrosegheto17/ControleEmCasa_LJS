import { useParams } from 'react-router';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ehUuid } from '../comum/uuid';
import { useConta } from '../ganchos/useContas';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { EdicaoConta } from './conta/EdicaoConta';
import { NovaConta } from './conta/NovaConta';

const LISTA = '/app/ajustes/contas';

function ContaExistente({ id }: { id: string }) {
  const consulta = useConta(id);
  const leitura = useLeituraComCache(consulta);
  const sumiu =
    consulta.data === undefined && consulta.error?.tipo === 'regra' && consulta.error.codigo === 'registro_invalido';
  if (sumiu) return <ContaInexistente />;
  return (
    <EstadosDeLeitura
      leitura={leitura}
      esqueleto={<EsqueletoLista linhas={3} />}
      aoTentarDeNovo={() => void consulta.refetch()}
    >
      {(conta) => <EdicaoConta conta={conta} />}
    </EstadosDeLeitura>
  );
}

function ContaInexistente() {
  return (
    <EstadoVazio
      icone="banco"
      titulo="Esta conta não existe mais"
      acao={
        <BotaoLink para={LISTA} variante="secundario">
          Voltar para Contas
        </BotaoLink>
      }
    />
  );
}

export function Conta() {
  const { id } = useParams();
  return (
    <>
      <CabecalhoPagina titulo={id ? 'Conta' : 'Nova conta'} voltarPara={LISTA} rotuloVoltar="Voltar para Contas" />
      <main>{id === undefined ? <NovaConta /> : ehUuid(id) ? <ContaExistente id={id} /> : <ContaInexistente />}</main>
    </>
  );
}
