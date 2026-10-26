import type { Escopo } from '../comum/enums';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { FormularioMeta } from '../componentes/metas/FormularioMeta';
import { MetaNaoExiste } from '../componentes/metas/MetaNaoExiste';
import { ehUuid } from '../comum/uuid';
import { LINK_METAS, LINK_PLANO, linkMeta } from '../formatacao/linksApp';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { useSomenteLeitura } from '../ganchos/usePlano';
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

/** Plano Free (RN-25): criar e editar meta ficam bloqueados; a tela explica e leva a Meu plano. */
function MetaBloqueada() {
  return (
    <EstadoVazio
      icone="alvo"
      titulo="Metas só para consulta no plano Free"
      texto="Assine o Pro para criar e editar metas. As metas que a casa já tem continuam visíveis."
      acao={
        <BotaoLink para={LINK_PLANO} variante="principal">
          Ver meu plano
        </BotaoLink>
      }
    />
  );
}

export function MetaFormulario() {
  const { id } = useParams();
  const somenteLeitura = useSomenteLeitura();
  return (
    <>
      <CabecalhoPagina
        titulo={id ? 'Editar meta' : 'Nova meta'}
        voltarPara={id ? linkMeta(id) : LINK_METAS}
        rotuloVoltar={id ? 'Voltar para a meta' : 'Voltar para Metas'}
      />
      <main>
        {somenteLeitura ? (
          <MetaBloqueada />
        ) : id === undefined ? (
          <MetaNova />
        ) : ehUuid(id) ? (
          <MetaExistente id={id} />
        ) : (
          <MetaNaoExiste />
        )}
      </main>
    </>
  );
}
