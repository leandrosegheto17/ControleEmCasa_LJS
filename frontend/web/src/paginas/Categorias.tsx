import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { Interruptor } from '../componentes/base/Interruptor';
import { Segmentado } from '../componentes/base/Segmentado';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ListaCategorias } from '../componentes/ListaCategorias';
import { useCategorias } from '../ganchos/useCategorias';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { lerTipoDaUrl } from '../formatacao/tipoUrl';
import { ORDEM_TIPO_LANCAMENTO, ROTULO_TIPO_LANCAMENTO } from '../rotulos/tipoLancamento';
import estilo from './Categorias.module.css';

const NOVA = '/app/ajustes/categorias/nova';
const OPCOES = ORDEM_TIPO_LANCAMENTO.map((valor) => ({ valor, rotulo: ROTULO_TIPO_LANCAMENTO[valor].plural }));

export function Categorias() {
  const [params, setParams] = useSearchParams();
  const tipo = lerTipoDaUrl(params);
  const consulta = useCategorias();
  const leitura = useLeituraComCache(consulta);
  const [arquivadas, setArquivadas] = useState(false);
  const visiveis = leitura.dados?.filter((c) => c.tipo === tipo && (arquivadas || !c.arquivada)) ?? [];
  const comLista = visiveis.length > 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Categorias"
        voltarPara="/app/ajustes"
        rotuloVoltar="Voltar para Ajustes"
        acao={
          comLista ? (
            <BotaoLink para={NOVA} variante="secundario" icone="mais">
              Nova
            </BotaoLink>
          ) : undefined
        }
      />
      <main>
        {leitura.situacao === 'erro' ? null : (
          <Segmentado
            legenda="Tipo de categoria"
            nome="tipo-categoria"
            opcoes={OPCOES}
            valor={tipo}
            aoMudar={(valor) => setParams({ tipo: valor }, { replace: true })}
          />
        )}
        <EstadosDeLeitura
          leitura={leitura}
          esqueleto={
            <div className={estilo.esqueleto}>
              <EsqueletoLista linhas={4} />
            </div>
          }
          aoTentarDeNovo={() => void consulta.refetch()}
        >
          {() =>
            comLista ? (
              <>
                <ListaCategorias categorias={visiveis} />
                <div className={estilo.interruptor}>
                  <Interruptor
                    rotulo="Mostrar arquivadas"
                    checked={arquivadas}
                    onChange={(e) => setArquivadas(e.target.checked)}
                  />
                </div>
              </>
            ) : (
              <EstadoVazio
                icone="lista"
                titulo={`Nenhuma categoria de ${ROTULO_TIPO_LANCAMENTO[tipo].texto.toLowerCase()} ativa`}
                texto="Todas foram arquivadas. Crie uma nova ou mostre as arquivadas para reativar."
                acao={
                  <BotaoLink para={NOVA} variante="principal" icone="mais">
                    Nova categoria
                  </BotaoLink>
                }
              />
            )
          }
        </EstadosDeLeitura>
      </main>
    </>
  );
}
