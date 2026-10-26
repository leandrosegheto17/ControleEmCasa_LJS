import { useId } from 'react';
import type { SaidaMovimentoMeta } from '@controle/contrato';

type MovimentosMeta = SaidaMovimentoMeta[];
import { formatarData } from '../../formatacao/data';
import { formatarMoeda } from '../../formatacao/moeda';
import { ROTULO_TIPO_MOVIMENTO } from '../../rotulos/tipoMovimento';
import listaEstilo from '../base/Lista.module.css';
import estilos from './Meta.module.css';

/** Movimentos na ordem da API. A conta só aparece se a linha a trouxer (RN-08): o servidor a manda apenas ao autor. */
export function HistoricoMeta({ movimentos }: { movimentos: MovimentosMeta }) {
  const id = useId();
  return (
    <section className={`${estilos.secao} ${estilos.apos}`} aria-labelledby={id}>
      <h2 id={id}>Histórico</h2>
      <ul className={listaEstilo.lista}>
        {movimentos.map((m) => {
          const aporte = m.tipo === 'aporte';
          return (
            <li key={m.id}>
              <span className={listaEstilo.info}>
                <span className={listaEstilo.titulo}>
                  {ROTULO_TIPO_MOVIMENTO[m.tipo].texto} · {m.autor.nome}
                </span>
                <span className={listaEstilo.sub}>
                  <span className="valor">{formatarData(m.data)}</span>
                  {` · ${m.local}`}
                  {m.conta ? ` · da conta ${m.conta.nome}` : ''}
                </span>
              </span>
              <span className={aporte ? `valor ${estilos['valor-receita']}` : 'valor'}>
                {aporte ? '+' : '−'} {formatarMoeda(m.valor_centavos)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={estilos.ajuda}>A conta de origem ou destino aparece só nos seus movimentos.</p>
    </section>
  );
}
