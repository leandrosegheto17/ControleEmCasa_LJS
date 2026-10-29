import type { SaidaLarDetalhe } from '@controle/contrato';
import { useState } from 'react';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { ListaMembros } from '../componentes/lar/ListaMembros';
import { useConectado } from '../ganchos/useConectado';
import { useLar } from '../ganchos/useLar';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { ConviteConectado } from './lar/ConviteConectado';
import { RemoverMembroConectado } from './lar/RemoverMembroConectado';
import { SairDaCasaConectado } from './lar/SairDaCasaConectado';

/** Membros do lar e convite do segundo membro (RN-22, RN-23). Disponível no Free (CA-23.8). */
export function Lar() {
  const consulta = useLar();
  const leitura = useLeituraComCache(consulta);
  const conectado = useConectado();
  const [removendo, setRemovendo] = useState<SaidaLarDetalhe['membros'][number] | null>(null);
  const [saindo, setSaindo] = useState(false);
  return (
    <>
      <CabecalhoPagina titulo="Casa e membros" voltarPara="/app/ajustes" rotuloVoltar="Voltar para Ajustes" />
      <main aria-busy={leitura.situacao === 'carregando'}>
        <EstadosDeLeitura
          leitura={leitura}
          esqueleto={<EsqueletoLista linhas={3} />}
          anuncioCarregando="Carregando os membros…"
          aoTentarDeNovo={() => void consulta.refetch()}
        >
          {(lar) => (
            <>
              <p className="texto-2 pequeno">{lar.lar.nome}</p>
              <ListaMembros
                membros={lar.membros}
                conectado={conectado}
                aoRemover={(id) => setRemovendo(lar.membros.find((m) => m.id === id) ?? null)}
                aoSair={() => setSaindo(true)}
              />
              <RemoverMembroConectado membro={removendo} aoFechar={() => setRemovendo(null)} />
              <SairDaCasaConectado aberto={saindo} aoFechar={() => setSaindo(false)} />
              <ConviteConectado lar={lar} />
            </>
          )}
        </EstadosDeLeitura>
      </main>
    </>
  );
}
