import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icone } from './Icone';
import estilo from './LinkMais.module.css';

type Props = { children: ReactNode; centralizado?: boolean; seta?: boolean } & (
  { para: string; aoClicar?: never } | { aoClicar: () => void; para?: never }
);

/** Ação discreta de texto: link de navegação (`para`) ou botão (`aoClicar`). `seta` acrescenta o ícone decorativo após o texto. */
export function LinkMais({ children, centralizado, seta, para, aoClicar }: Props) {
  const classe = [estilo['link-mais'], centralizado ? estilo.centro : null].filter(Boolean).join(' ');
  const conteudo = (
    <>
      {children}
      {seta ? <Icone nome="dir" /> : null}
    </>
  );
  if (para !== undefined) {
    return (
      <Link to={para} className={classe}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type="button" className={classe} onClick={aoClicar}>
      {conteudo}
    </button>
  );
}
