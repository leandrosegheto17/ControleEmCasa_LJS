import type { InputHTMLAttributes, Ref } from 'react';
import { Campo, type PropsCampoBase } from './Campo';
import estilo from './Campo.module.css';

type Props = PropsCampoBase &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'disabled' | 'type' | 'className'> & {
    ref?: Ref<HTMLInputElement>;
    /** `date` (padrão) ou `month` para mês e ano. */
    tipo?: 'date' | 'month';
  };

/** `value` e o valor entregue em `onChange` são AAAA-MM-DD (`date`) ou AAAA-MM (`month`). */
export function CampoData({ rotulo, ajuda, erro, desabilitado, id, ref, tipo = 'date', ...resto }: Props) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erro} id={id}>
      {(ligacao) => (
        <input {...resto} {...ligacao} ref={ref} type={tipo} disabled={desabilitado} className={estilo.entrada} />
      )}
    </Campo>
  );
}
