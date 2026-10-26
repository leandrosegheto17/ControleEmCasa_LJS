import type { Escopo } from '../comum/enums';
import type { SaidaLinhaCategorias as LinhaCategorias } from '@controle/contrato';
import { ORDEM_ESCOPO, ROTULO_ESCOPO } from '../rotulos/escopo';
import { Icone } from './base/Icone';
import { ItemLink } from './base/ItemLink';
import { SeloSituacao } from './base/SeloSituacao';
import { GrupoMenu } from './GrupoMenu';
import estilo from './ListaCategorias.module.css';

const COMPLEMENTO: Record<Escopo, string> = { conjunto: 'os dois veem', individual: 'só você vê' };
const CLASSE_ICONE: Record<Escopo, 'casa' | 'eu'> = { conjunto: 'casa', individual: 'eu' };
const ID_GRUPO: Record<Escopo, string> = { conjunto: 'g-casa', individual: 'g-minhas' };

function ItemCategoria({ categoria }: { categoria: LinhaCategorias }) {
  return (
    <ItemLink
      rotulo={categoria.nome}
      subtitulo={categoria.arquivada ? 'Arquivada' : undefined}
      para={`/app/ajustes/categorias/${categoria.id}`}
      direita={categoria.variavel === true ? <SeloSituacao situacao="variavel" /> : undefined}
      seta={false}
    />
  );
}

/** Categorias de um tipo, agrupadas por escopo (da casa, depois minhas), sem grupo vazio. */
export function ListaCategorias({ categorias }: { categorias: readonly LinhaCategorias[] }) {
  return (
    <>
      {ORDEM_ESCOPO.map((escopo) => {
        const doEscopo = categorias.filter((c) => c.escopo === escopo);
        const rotulo = ROTULO_ESCOPO[escopo];
        return doEscopo.length === 0 ? null : (
          <GrupoMenu
            key={escopo}
            idTitulo={ID_GRUPO[escopo]}
            titulo={
              <>
                <Icone nome={rotulo.icone} className={`${estilo.icone} ${estilo[CLASSE_ICONE[escopo]]}`} />{' '}
                {rotulo.grupo} · {COMPLEMENTO[escopo]}
              </>
            }
          >
            {doEscopo.map((categoria) => (
              <ItemCategoria key={categoria.id} categoria={categoria} />
            ))}
          </GrupoMenu>
        );
      })}
    </>
  );
}
