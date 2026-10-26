import type { InputHTMLAttributes, Ref } from 'react';
import estilo from './Interruptor.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'disabled' | 'type' | 'role' | 'className'> & {
  rotulo: string;
  ajuda?: string;
  desabilitado?: boolean;
  ref?: Ref<HTMLInputElement>;
};

export function Interruptor({ rotulo, ajuda, desabilitado, ref, ...resto }: Props) {
  return (
    // O clique é cancelado aqui porque o React não entrega onClick a controle desabilitado,
    // e alguns ambientes (jsdom) ainda alternam o checkbox num clique sintético.
    <label className={estilo.interruptor} onClick={desabilitado ? (e) => e.preventDefault() : undefined}>
      <span className={estilo.texto}>
        {rotulo}
        {ajuda ? (
          <>
            <br />
            <small className={estilo.ajuda}>{ajuda}</small>
          </>
        ) : null}
      </span>
      <input {...resto} ref={ref} type="checkbox" role="switch" disabled={desabilitado} />
    </label>
  );
}
