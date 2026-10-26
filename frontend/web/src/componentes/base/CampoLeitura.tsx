import { useId, type ReactNode } from 'react';
import estilo from './CampoLeitura.module.css';

interface Props {
  rotulo: string;
  texto: ReactNode;
  ajuda?: string;
}

/** Valor só de leitura com rótulo e ajuda ligados ao texto. */
export function CampoLeitura({ rotulo, texto, ajuda }: Props) {
  const id = useId();
  const idRotulo = `${id}-rotulo`;
  const idAjuda = `${id}-ajuda`;
  return (
    <div className={estilo.campo}>
      <span id={idRotulo} className={estilo.rotulo}>
        {rotulo}
      </span>
      <p
        className={estilo.texto}
        role="group"
        aria-labelledby={idRotulo}
        aria-describedby={ajuda ? idAjuda : undefined}
      >
        {texto}
      </p>
      {ajuda ? (
        <p id={idAjuda} className={estilo.ajuda}>
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}
