import type { InputHTMLAttributes, Ref } from 'react';
import { Campo, type PropsCampoBase } from './Campo';
import estilo from './Campo.module.css';

type Props = PropsCampoBase &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'disabled' | 'className'> & {
    ref?: Ref<HTMLInputElement>;
    /** Valores já usados, oferecidos como sugestão (o texto continua livre). */
    sugestoes?: string[];
  };

export function CampoTexto({ rotulo, ajuda, erro, desabilitado, id, type = 'text', ref, sugestoes, ...resto }: Props) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erro} id={id}>
      {(ligacao) => {
        const idLista = sugestoes ? `${ligacao.id}-sugestoes` : undefined;
        return (
          <>
            <input
              {...resto}
              {...ligacao}
              ref={ref}
              type={type}
              list={idLista}
              disabled={desabilitado}
              className={estilo.entrada}
            />
            {sugestoes ? (
              <datalist id={idLista}>
                {sugestoes.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            ) : null}
          </>
        );
      }}
    </Campo>
  );
}
