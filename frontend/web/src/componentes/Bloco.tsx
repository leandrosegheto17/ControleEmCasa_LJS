import type { ReactNode } from 'react';
import { Icone } from './base/Icone';
import estilos from './Bloco.module.css';

interface Props {
  bloco: 'casa' | 'eu';
  /** Texto do título `h2` ("Casa", "Da casa"). */
  titulo: string;
  /** Nome do membro no bloco Eu ("Eu · Leandro"). */
  nome?: string;
  /** `id` do título; o padrão é `titulo-casa` / `titulo-eu`. */
  idTitulo?: string;
  /** Colunas da grade em tela larga. */
  colunas?: 2 | 3;
  /** Conteúdo sem a grade (estado vazio da seção). */
  semGrade?: boolean;
  /** No esqueleto o bloco só é nomeado por rótulo e a grade é decorativa. */
  carregando?: boolean;
  children: ReactNode;
}

/** Seção da casa ou do membro: título `h2` com ícone e a grade de cartões. */
export function Bloco({
  bloco,
  titulo,
  nome,
  idTitulo = `titulo-${bloco}`,
  colunas = 3,
  semGrade = false,
  carregando = false,
  children,
}: Props) {
  const nomeacao = carregando ? { 'aria-label': titulo } : { 'aria-labelledby': idTitulo };
  const classesGrade = `${estilos.grade}${colunas === 2 ? ` ${estilos['grade-2']}` : ''}`;
  return (
    <section className={`${estilos.bloco} ${estilos[bloco]}`} {...nomeacao}>
      <h2 className={estilos['bloco-titulo']} id={carregando ? undefined : idTitulo}>
        <Icone nome={bloco === 'casa' ? 'casa' : 'pessoa'} />
        {titulo}
        {nome ? (
          <>
            {' '}
            <span className={estilos.nome}>· {nome}</span>
          </>
        ) : null}
      </h2>
      {semGrade ? (
        children
      ) : (
        <div className={classesGrade} aria-hidden={carregando ? true : undefined}>
          {children}
        </div>
      )}
    </section>
  );
}
