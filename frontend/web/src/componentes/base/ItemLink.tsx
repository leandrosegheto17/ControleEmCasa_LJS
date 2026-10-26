import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icone, type NomeIcone } from './Icone';
import estilo from './Lista.module.css';

type Props = {
  icone?: NomeIcone;
  rotulo: string;
  /** Linha de apoio sob o rótulo. */
  subtitulo?: string;
  /** Número exibido antes da seta. */
  contagem?: number;
  /** Valor à direita (substitui a seta) e nota curta antes dele. */
  valor?: string;
  nota?: string;
  /** Conteúdo livre à direita do link (substitui valor, nota e seta). */
  direita?: ReactNode;
  /** Cor de ação destrutiva (via classe). */
  destrutivo?: boolean;
  /** Mostra a seta também no item de ação; o link a mostra, salvo com `seta={false}`. */
  seta?: boolean;
} & ({ para: string; aoClicar?: never } | { aoClicar: () => void; para?: never });

/** Item de `ul.lista`: link de navegação (`para`, com seta) ou botão (`aoClicar`). */
export function ItemLink({
  icone,
  rotulo,
  subtitulo,
  contagem,
  valor,
  nota,
  direita,
  destrutivo,
  seta,
  para,
  aoClicar,
}: Props) {
  const classe = destrutivo ? `${estilo.link} ${estilo.perigo}` : estilo.link;
  const rotuloComIcone = (
    <span className={estilo.titulo}>
      {icone ? <Icone nome={icone} /> : null}
      {rotulo}
    </span>
  );
  const titulo =
    subtitulo === undefined ? (
      rotuloComIcone
    ) : (
      <span className={estilo.info}>
        {rotuloComIcone}
        <span className={estilo.sub}>{subtitulo}</span>
      </span>
    );
  if (para === undefined) {
    return (
      <li>
        <button type="button" className={classe} onClick={aoClicar}>
          {titulo}
          {seta ? (
            <span className={estilo.sub}>
              <Icone nome="dir" className={estilo.seta} />
            </span>
          ) : null}
        </button>
      </li>
    );
  }
  const fim =
    direita !== undefined ? (
      direita
    ) : valor === undefined ? (
      seta === false && contagem === undefined ? null : (
        <span className={subtitulo === undefined ? estilo.sub : `${estilo.sub} ${estilo.destaque}`}>
          {contagem}
          <Icone nome="dir" className={estilo.seta} />
        </span>
      )
    ) : nota === undefined ? (
      <span className="valor">{valor}</span>
    ) : (
      <span className={estilo.fim}>
        <span className={estilo.sub}>{nota}</span>
        <span className="valor">{valor}</span>
      </span>
    );
  return (
    <li>
      <Link to={para} className={classe}>
        {titulo}
        {fim}
      </Link>
    </li>
  );
}
