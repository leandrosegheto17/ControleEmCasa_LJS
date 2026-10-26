import type { Ref, SelectHTMLAttributes } from 'react';
import { Campo, type PropsCampoBase } from './Campo';
import estilo from './Campo.module.css';

type Props = PropsCampoBase &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'disabled' | 'children' | 'className'> & {
    opcoes: { valor: string; rotulo: string }[];
    ref?: Ref<HTMLSelectElement>;
  };

export function Selecao({ rotulo, ajuda, erro, desabilitado, id, opcoes, ref, ...resto }: Props) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erro} id={id}>
      {(ligacao) => (
        <select {...resto} {...ligacao} ref={ref} disabled={desabilitado} className={estilo.entrada}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      )}
    </Campo>
  );
}
