import { CabecalhoMetas } from '../componentes/metas/CabecalhoMetas';
import { EsqueletoMetas } from '../componentes/metas/EsqueletoMetas';
import { SecaoMetas } from '../componentes/metas/SecaoMetas';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { linkMetaNova } from '../formatacao/linksApp';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { useMetas } from '../ganchos/useMetas';

export function Metas() {
  const consulta = useMetas();
  const leitura = useLeituraComCache(consulta);

  return (
    <>
      <CabecalhoMetas />
      <main aria-busy={leitura.situacao === 'carregando'}>
        <EstadosDeLeitura
          leitura={leitura}
          esqueleto={<EsqueletoMetas />}
          anuncioCarregando="Carregando as metas…"
          aoTentarDeNovo={() => void consulta.refetch()}
        >
          {(metas) => (
            <>
              <SecaoMetas
                bloco="casa"
                titulo="Da casa"
                metas={metas.filter((m) => m.escopo === 'conjunto')}
                textoVazio="Nenhuma meta da casa ainda. Uma meta da casa mostra aos dois quanto falta e quem guardou."
                rotuloNova="Nova meta da casa"
                destinoNova={linkMetaNova('casa')}
              />
              <SecaoMetas
                bloco="eu"
                titulo="Minhas"
                metas={metas.filter((m) => m.escopo === 'individual')}
                textoVazio="Nenhuma meta sua ainda. Só você vê as suas metas."
                rotuloNova="Nova meta minha"
                destinoNova={linkMetaNova('eu')}
              />
            </>
          )}
        </EstadosDeLeitura>
      </main>
    </>
  );
}
