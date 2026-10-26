import { BotaoLink } from '../componentes/base/BotaoLink';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ListaFormas } from '../componentes/ListaFormas';
import { useFormasPagamento } from '../ganchos/useFormasPagamento';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';

const NOVA = '/app/ajustes/formas/nova';

export function FormasPagamento() {
  const consulta = useFormasPagamento();
  const leitura = useLeituraComCache(consulta);
  const ativas = leitura.dados?.filter((forma) => !forma.arquivada) ?? [];
  const comLista = ativas.length > 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Formas de pagamento"
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
                <p className="texto-2 pequeno">Só você vê as suas formas de pagamento.</p>
                <ListaFormas formas={ativas} />
              </>
            ) : (
              <EstadoVazio
                icone="cartao"
                titulo="Nenhuma forma de pagamento"
                texto="Cadastre um Pix, um débito ou um cartão de crédito para começar a lançar."
                acao={
                  <BotaoLink para={NOVA} variante="principal" icone="mais">
                    Nova forma
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
