import type { SaidaLinhaMetas as LinhaMetas } from '@controle/contrato';
import { Bloco } from '../Bloco';
import { BotaoLink } from '../base/BotaoLink';
import { EstadoVazio } from '../base/EstadoVazio';
import { CartaoMeta } from './CartaoMeta';

interface Props {
  bloco: 'casa' | 'eu';
  titulo: string;
  metas: LinhaMetas[];
  textoVazio: string;
  rotuloNova: string;
  /** Destino do botão do estado vazio, já com o escopo. */
  destinoNova: string;
}

/** Uma seção da lista de metas; sem metas mostra o próprio estado vazio. */
export function SecaoMetas({ bloco, titulo, metas, textoVazio, rotuloNova, destinoNova }: Props) {
  const idTitulo = `t-${bloco}`;
  if (metas.length === 0) {
    return (
      <Bloco bloco={bloco} titulo={titulo} idTitulo={idTitulo} semGrade>
        <EstadoVazio
          icone="alvo"
          texto={textoVazio}
          semMargem
          acao={
            <BotaoLink para={destinoNova} variante={bloco === 'casa' ? 'principal' : 'secundario'}>
              {rotuloNova}
            </BotaoLink>
          }
        />
      </Bloco>
    );
  }
  return (
    <Bloco bloco={bloco} titulo={titulo} idTitulo={idTitulo} colunas={2}>
      {metas.map((meta) => (
        <CartaoMeta key={meta.id} meta={meta} bloco={bloco} />
      ))}
    </Bloco>
  );
}
