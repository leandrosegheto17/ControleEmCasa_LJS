import { useParams } from 'react-router';
import { BotaoIcone } from '../componentes/base/BotaoIcone';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { AvisoPlanoFree } from '../componentes/plano/AvisoPlanoFree';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { SeloEscopo } from '../componentes/base/SeloEscopo';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { EsqueletoMeta } from '../componentes/metas/EsqueletoMeta';
import { HistoricoMeta } from '../componentes/metas/HistoricoMeta';
import { MetaNaoExiste } from '../componentes/metas/MetaNaoExiste';
import estilos from '../componentes/metas/Meta.module.css';
import { OndeGuardado } from '../componentes/metas/OndeGuardado';
import { ResumoMeta } from '../componentes/metas/ResumoMeta';
import { LINK_METAS, linkMeta, linkMetaEditar } from '../formatacao/linksApp';
import { useSomenteLeitura } from '../ganchos/usePlano';
import { MovimentarMetaConectada } from './metas/MovimentarMetaConectada';
import { useDetalheMeta, type DetalheMeta } from './metas/useDetalheMeta';

function Conteudo({ meta, movimentos }: DetalheMeta) {
  const somenteLeitura = useSomenteLeitura();
  const conjunto = meta.escopo === 'conjunto';
  const vazio = movimentos.length === 0;
  const aportar = (
    <BotaoLink para={linkMeta(meta.id, { movimentar: 'aporte' })} variante="principal">
      Aportar
    </BotaoLink>
  );

  return (
    <>
      <p className={estilos['selo-linha']}>
        <SeloEscopo escopo={meta.escopo} texto={conjunto ? 'Meta da casa' : 'Minha meta'} />
        {conjunto ? '· visível aos dois' : '· só você vê'}
      </p>
      <div className={vazio ? `${estilos.grade} ${estilos['grade-cheia']}` : estilos.grade}>
        <ResumoMeta
          meta={meta}
          acoes={
            vazio || somenteLeitura ? null : (
              <>
                {aportar}
                <BotaoLink para={linkMeta(meta.id, { movimentar: 'retirada' })} variante="secundario">
                  Retirar
                </BotaoLink>
              </>
            )
          }
        />
        {vazio ? null : <OndeGuardado locais={meta.por_local ?? []} />}
      </div>
      {vazio ? (
        <EstadoVazio
          icone="alvo"
          titulo="Nenhum aporte ainda"
          texto={
            somenteLeitura
              ? 'Nenhum aporte registrado. No plano Free as metas ficam só para consulta.'
              : 'Registre quanto guardou e onde está o dinheiro (por exemplo, "Caixinha Nubank").'
          }
          acao={somenteLeitura ? undefined : aportar}
        />
      ) : (
        <HistoricoMeta movimentos={movimentos} />
      )}
      {somenteLeitura ? null : <MovimentarMetaConectada meta={meta} />}
    </>
  );
}

export function Meta() {
  const { id = '' } = useParams();
  const somenteLeitura = useSomenteLeitura();
  const { leitura, naoExiste, recarregar } = useDetalheMeta(id);
  const nome = leitura.dados?.meta.nome;

  return (
    <>
      <CabecalhoPagina
        titulo={nome ?? 'Meta'}
        voltarPara={LINK_METAS}
        rotuloVoltar="Voltar para Metas"
        acao={
          nome === undefined || somenteLeitura ? undefined : (
            <BotaoIcone icone="editar" rotulo="Editar meta" para={linkMetaEditar(id)} />
          )
        }
      />
      <main>
        {somenteLeitura ? <AvisoPlanoFree recurso="metas" /> : null}
        {naoExiste ? (
          <MetaNaoExiste />
        ) : (
          <EstadosDeLeitura
            leitura={leitura}
            esqueleto={<EsqueletoMeta />}
            anuncioCarregando="Carregando a meta…"
            aoTentarDeNovo={recarregar}
          >
            {(dados) => <Conteudo {...dados} />}
          </EstadosDeLeitura>
        )}
      </main>
    </>
  );
}
