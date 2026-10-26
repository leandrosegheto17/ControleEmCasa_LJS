import type { ReactNode } from 'react';
import { Icone } from './Icone';
import estilo from './Nota.module.css';

/** Observação neutra dentro de formulário; com `icone`, o aviso vem antes do texto. */
export function Nota({ children, icone = false }: { children: ReactNode; icone?: boolean }) {
  return (
    <p className={estilo.nota}>
      {icone ? (
        <>
          <Icone nome="aviso" />{' '}
        </>
      ) : null}
      {children}
    </p>
  );
}
