import { useId, type ReactNode } from 'react';
import lista from './base/Lista.module.css';
import estilo from './GrupoMenu.module.css';

interface Props {
  titulo: ReactNode;
  children: ReactNode;
  /** Conteúdo logo abaixo da lista (ex.: botão de criar). */
  rodape?: ReactNode;
  /** Id fixo do título (âncora); sem ele, é gerado. */
  idTitulo?: string;
}

/** Seção de menu com título e lista; o nome da região é o título. */
export function GrupoMenu({ titulo, children, rodape, idTitulo }: Props) {
  const idGerado = useId();
  const id = idTitulo ?? idGerado;
  return (
    <section className={estilo.grupo} aria-labelledby={id}>
      <h2 id={id} className={estilo.titulo}>
        {titulo}
      </h2>
      <ul className={`${lista.lista} ${estilo.lista}`}>{children}</ul>
      {rodape}
    </section>
  );
}
