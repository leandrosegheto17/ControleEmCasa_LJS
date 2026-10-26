import type { Escopo } from '../comum/enums';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { FormularioMeta } from '../componentes/metas/FormularioMeta';
import { MetaNaoExiste } from '../componentes/metas/MetaNaoExiste';
import { ehUuid } from '../comum/uuid';
import { LINK_METAS, linkMeta } from '../formatacao/linksApp';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { useMeta } from '../ganchos/useMetas';
import { useSalvarMeta } from './metas/useSalvarMeta';

const ESQUELETO = <EsqueletoLista linhas={4} />;

function MetaNova() {
  const [params] = useSearchParams();
  const escopoPadrao: Escopo = params.get('escopo') === 'casa' ? 'conjunto' : 'individual';
  // O mesmo id em todos os envios: reenviar depois de uma falha de rede não cria duas metas.
  const [id] = useState(() => crypto.randomUUID());
  const { salvando, salvar } = useSalvarMeta(id);
  return <FormularioMeta escopoPadrao={escopoPadrao} salvando={salvando} aoSalvar={salvar} />;
}

function MetaExistente({ id }: { id: string }) {
  const consulta = useMeta(id);
  const leitura = useLeituraComCache(consulta);
  const { salvando, salvar } = useSalvarMeta(id);
  const sumiu =
    consulta.data === undefined && consulta.error?.tipo === 'regra' && consulta.error.codigo === 'registro_invalido';
  if (sumiu) return <MetaNaoExiste />;
  return (
    <EstadosDeLeitura leitura={leitura} esqueleto={ESQUELETO} aoTentarDeNovo={() => void consulta.refetch()}>
      {(meta) => (
        <FormularioMeta
          inicial={{
            nome: meta.nome,
            alvoCentavos: meta.alvo_centavos,
            prazo: meta.prazo ?? null,
            escopo: meta.escopo,
          }}
          salvando={salvando}
          aoSalvar={salvar}
        />
      )}
    </EstadosDeLeitura>
  );
}

export function MetaFormulario() {
  const { id } = useParams();
  return (
    <>
      <CabecalhoPagina
        titulo={id ? 'Editar meta' : 'Nova meta'}
        voltarPara={id ? linkMeta(id) : LINK_METAS}
        rotuloVoltar={id ? 'Voltar para a meta' : 'Voltar para Metas'}
      />
      <main>{id === undefined ? <MetaNova /> : ehUuid(id) ? <MetaExistente id={id} /> : <MetaNaoExiste />}</main>
    </>
  );
}
