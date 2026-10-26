import type { ItemFila } from '../../comum/fila';
import { formatarMoeda } from '../../formatacao/moeda';
import { Botao } from '../base/Botao';
import { Icone } from '../base/Icone';
import { SeloEscopo } from '../base/SeloEscopo';
import { SeloSituacao } from '../base/SeloSituacao';
import lista from '../base/Lista.module.css';
import estilo from './ItemEnvio.module.css';
import { situacaoEnvio, subtituloEnvio, tituloEnvio } from './textoEnvio';

interface Props {
  item: ItemFila;
  enviando: boolean;
  aoCorrigir: (item: ItemFila) => void;
  aoDescartar: (item: ItemFila) => void;
}

/** Linha da folha de envios. O elemento de situação é o mesmo nos dois estados, para a mudança ser anunciada. */
export function ItemEnvio({ item, enviando, aoCorrigir, aoDescartar }: Props) {
  const falhou = item.situacao === 'falhou';
  const valor = formatarMoeda(item.args.valor_centavos);
  const descricao = `lançamento ${tituloEnvio(item)} ${valor}`;
  return (
    <li>
      <span className={lista.info}>
        <span className={lista.titulo}>
          {tituloEnvio(item)} · <span className="valor">{valor}</span>
        </span>
        <span className={lista.sub}>
          <SeloEscopo escopo={item.exibicao.escopo ?? 'individual'} /> {subtituloEnvio(item)}
        </span>
        <span role="status" className={falhou ? estilo.erro : lista.sub}>
          {falhou ? (
            <>
              <Icone nome="alerta" />
              {situacaoEnvio(item)}
            </>
          ) : enviando ? (
            'Enviando…'
          ) : (
            <SeloSituacao situacao="aguardando" />
          )}
        </span>
      </span>
      <span className={lista.direita}>
        {falhou ? (
          <Botao variante="secundario" aria-label={`Corrigir ${descricao}`} onClick={() => aoCorrigir(item)}>
            Corrigir
          </Botao>
        ) : null}
        <Botao variante="texto" aria-label={`Descartar ${descricao}`} onClick={() => aoDescartar(item)}>
          Descartar
        </Botao>
      </span>
    </li>
  );
}
