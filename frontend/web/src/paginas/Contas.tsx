import { useState } from 'react';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { Interruptor } from '../componentes/base/Interruptor';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ListaContas } from '../componentes/ListaContas';
import { useContas } from '../ganchos/useContas';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import estilo from './Contas.module.css';

const NOVA = '/app/ajustes/contas/nova';

export function Contas() {
  const consulta = useContas();
  const leitura = useLeituraComCache(consulta);
  const [arquivadas, setArquivadas] = useState(false);
  const visiveis = leitura.dados?.filter((conta) => arquivadas || !conta.arquivada) ?? [];
  const comLista = visiveis.length > 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Contas"
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
        <EstadosDeLeitura
          leitura={leitura}
          esqueleto={<EsqueletoLista linhas={3} />}
          aoTentarDeNovo={() => void consulta.refetch()}
        >
          {() =>
            comLista ? (
              <>
                <p className="texto-2 pequeno">Só você vê as suas contas e saldos.</p>
                <ListaContas contas={visiveis} />
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
                icone="banco"
                titulo="Nenhuma conta cadastrada"
                texto="Cadastre suas contas correntes para acompanhar o saldo. Só você vê."
                acao={
                  <BotaoLink para={NOVA} variante="principal" icone="mais">
                    Nova conta
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
