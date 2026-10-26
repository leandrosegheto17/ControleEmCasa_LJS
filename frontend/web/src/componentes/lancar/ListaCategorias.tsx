import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { CampoTexto } from '../base/CampoTexto';
import { ORDEM_ESCOPO, ROTULO_ESCOPO } from '../../rotulos/escopo';
import { filtrarCategorias } from './filtrarCategorias';
import estilos from './ListaCategorias.module.css';

type Categorias = Pick<DadosLancamento['categorias_despesa'][number], 'id' | 'nome' | 'escopo'>[];

interface Props {
  categorias: Categorias;
  aoEscolher: (id: string) => void;
  aoFechar: () => void;
}

/** Todas as categorias, com busca, em "Casa" e "Minhas"; o Esc fecha sem propagar para a folha. */
export function ListaCategorias({ categorias, aoEscolher, aoFechar }: Props) {
  const [termo, setTermo] = useState('');
  const busca = useRef<HTMLInputElement>(null);
  const idTitulo = useId();
  const achadas = filtrarCategorias(categorias, termo);

  useEffect(() => busca.current?.focus(), []);

  const aoTeclar = (evento: KeyboardEvent) => {
    if (evento.key !== 'Escape') return;
    evento.stopPropagation();
    aoFechar();
  };

  return (
    <div className={estilos.lista} onKeyDown={aoTeclar}>
      <CampoTexto
        ref={busca}
        type="search"
        rotulo="Buscar categoria"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        autoComplete="off"
      />
      {achadas.length === 0 ? <p className={estilos.vazio}>Nenhuma categoria encontrada</p> : null}
      {ORDEM_ESCOPO.map((escopo) => {
        const doGrupo = achadas.filter((c) => c.escopo === escopo);
        if (doGrupo.length === 0) return null;
        const titulo = ROTULO_ESCOPO[escopo].lista;
        return (
          <div key={escopo} role="group" aria-labelledby={`${idTitulo}-${escopo}`} className={estilos.grupo}>
            <h3 id={`${idTitulo}-${escopo}`} className={estilos.titulo}>
              {titulo}
            </h3>
            {doGrupo.map((c) => (
              <button key={c.id} type="button" className={estilos.item} onClick={() => aoEscolher(c.id)}>
                {c.nome}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
