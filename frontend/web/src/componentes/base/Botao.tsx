import type { ButtonHTMLAttributes, MouseEvent, Ref } from 'react';
import { Icone, type NomeIcone } from './Icone';
import estilo from './Botao.module.css';
import giro from './Giro.module.css';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className'> & {
  variante: 'principal' | 'secundario' | 'perigo' | 'texto';
  bloco?: boolean;
  icone?: NomeIcone;
  tipo?: 'button' | 'submit' | 'reset';
  salvando?: boolean;
  /** Texto durante `salvando`. */
  rotuloOcupado?: string;
  ref?: Ref<HTMLButtonElement>;
};

export function Botao({
  variante,
  bloco,
  icone,
  tipo = 'button',
  salvando,
  rotuloOcupado = 'Salvando…',
  onClick,
  children,
  ref,
  ...resto
}: Props) {
  const classes = [estilo.botao, estilo[variante], bloco ? estilo.bloco : null].filter(Boolean).join(' ');

  // aria-disabled em vez de disabled: o foco fica no botão; o clique é barrado aqui para impedir envio duplo.
  function aoClicar(e: MouseEvent<HTMLButtonElement>) {
    if (salvando) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }

  return (
    <button
      {...resto}
      ref={ref}
      type={tipo}
      className={classes}
      aria-disabled={salvando ? 'true' : undefined}
      onClick={aoClicar}
    >
      {salvando ? (
        <>
          <Icone nome="recarregar" className={giro.giro} />
          {rotuloOcupado}
        </>
      ) : (
        <>
          {icone ? <Icone nome={icone} /> : null}
          {children}
        </>
      )}
    </button>
  );
}
