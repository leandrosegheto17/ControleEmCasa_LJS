import { useParams } from 'react-router';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ehUuid } from '../comum/uuid';
import { useCategoria } from '../ganchos/useCategorias';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { EdicaoCategoria } from './categoria/EdicaoCategoria';
import { NovaCategoria } from './categoria/NovaCategoria';

const LISTA = '/app/ajustes/categorias';

function CategoriaExistente({ id }: { id: string }) {
  const consulta = useCategoria(id);
  const leitura = useLeituraComCache(consulta);
  const sumiu =
    consulta.data === undefined && consulta.error?.tipo === 'regra' && consulta.error.codigo === 'registro_invalido';
  if (sumiu) return <CategoriaInexistente />;
  return (
    <EstadosDeLeitura
      leitura={leitura}
      esqueleto={<EsqueletoLista linhas={3} />}
      aoTentarDeNovo={() => void consulta.refetch()}
    >
      {(categoria) => <EdicaoCategoria categoria={categoria} />}
    </EstadosDeLeitura>
  );
}

function CategoriaInexistente() {
  return (
    <EstadoVazio
      icone="lista"
      titulo="Esta categoria não existe mais"
      acao={
        <BotaoLink para={LISTA} variante="secundario">
          Voltar para Categorias
        </BotaoLink>
      }
    />
  );
}

export function Categoria() {
  const { id } = useParams();
  return (
    <>
      <CabecalhoPagina
        titulo={id ? 'Categoria' : 'Nova categoria'}
        voltarPara={LISTA}
        rotuloVoltar="Voltar para Categorias"
      />
      <main>
        {id === undefined ? <NovaCategoria /> : ehUuid(id) ? <CategoriaExistente id={id} /> : <CategoriaInexistente />}
      </main>
    </>
  );
}
