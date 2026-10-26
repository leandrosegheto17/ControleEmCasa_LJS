import { useState } from 'react';
import { useParams } from 'react-router';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ehUuid } from '../comum/uuid';
import { linkFixas } from '../formatacao/linksApp';
import { useCategorias } from '../ganchos/useCategorias';
import { useDespesaFixa } from '../ganchos/useDespesasFixas';
import { useLeituraComCache, type LeituraComCache } from '../ganchos/useLeituraComCache';
import { useMesDaUrl } from '../ganchos/useMesDaUrl';
import { EditorFixa } from './fixa/EditorFixa';

/** Uma só leitura para duas consultas: pronta com as duas, em cache se alguma está, erro se alguma falhou sem dado. */
function juntar<A, B>(a: LeituraComCache<A>, b: LeituraComCache<B>): LeituraComCache<{ modelo: A; categorias: B }> {
  if (a.dados !== undefined && b.dados !== undefined) {
    const emCache = a.situacao === 'cache' || b.situacao === 'cache';
    return {
      situacao: emCache ? 'cache' : 'pronto',
      dados: { modelo: a.dados, categorias: b.dados },
      atualizadoEm: Math.min(a.atualizadoEm, b.atualizadoEm),
    };
  }
  const falhou = a.situacao === 'erro' || b.situacao === 'erro';
  return { situacao: falhou ? 'erro' : 'carregando', dados: undefined, atualizadoEm: 0 };
}

const ESQUELETO = <EsqueletoLista linhas={4} />;

function FixaNova({ mes }: { mes: string }) {
  // O mesmo id em todos os envios: reenviar depois de uma falha de rede não cria duas despesas fixas.
  const [id] = useState(() => crypto.randomUUID());
  const categorias = useCategorias();
  const leituraCategorias = useLeituraComCache(categorias);
  return (
    <EstadosDeLeitura
      leitura={leituraCategorias}
      esqueleto={ESQUELETO}
      aoTentarDeNovo={() => void categorias.refetch()}
    >
      {(lista) => <EditorFixa id={id} mes={mes} categorias={lista} />}
    </EstadosDeLeitura>
  );
}

function FixaExistente({ id, mes }: { id: string; mes: string }) {
  const consulta = useDespesaFixa(id);
  const categorias = useCategorias();
  const leituraModelo = useLeituraComCache(consulta);
  const leituraCategorias = useLeituraComCache(categorias);
  const sumiu =
    consulta.data === undefined && consulta.error?.tipo === 'regra' && consulta.error.codigo === 'registro_invalido';
  if (sumiu) return <FixaInexistente mes={mes} />;
  const recarregar = () => {
    void consulta.refetch();
    void categorias.refetch();
  };
  const leitura = juntar(leituraModelo, leituraCategorias);
  return (
    <EstadosDeLeitura leitura={leitura} esqueleto={ESQUELETO} aoTentarDeNovo={recarregar}>
      {({ modelo, categorias: lista }) => <EditorFixa id={id} mes={mes} categorias={lista} modelo={modelo} />}
    </EstadosDeLeitura>
  );
}

function FixaInexistente({ mes }: { mes: string }) {
  return (
    <EstadoVazio
      icone="relogio"
      titulo="Esta despesa fixa não existe mais"
      acao={
        <BotaoLink para={linkFixas({ mes })} variante="secundario">
          Voltar para Despesas fixas
        </BotaoLink>
      }
    />
  );
}

export function DespesaFixa() {
  const { id } = useParams();
  const [mes] = useMesDaUrl();
  return (
    <>
      <CabecalhoPagina
        titulo={id ? 'Despesa fixa' : 'Nova despesa fixa'}
        voltarPara={linkFixas({ mes })}
        rotuloVoltar="Voltar para Despesas fixas"
      />
      <main>
        {id === undefined ? (
          <FixaNova mes={mes} />
        ) : ehUuid(id) ? (
          <FixaExistente id={id} mes={mes} />
        ) : (
          <FixaInexistente mes={mes} />
        )}
      </main>
    </>
  );
}
