import type { ReactNode } from 'react';
import { Icone, type NomeIcone } from './Icone';
import estilos from './Selo.module.css';

interface Props {
  classes: readonly string[];
  icone?: NomeIcone;
  children: ReactNode;
}

/** Casca comum dos selos: o ícone é decorativo e o texto é o nome acessível. */
export function SeloBase({ classes, icone, children }: Props) {
  const nomes = ['selo', ...classes].map((c) => estilos[c] ?? c).join(' ');
  return (
    <span className={nomes}>
      {icone ? <Icone nome={icone} /> : null}
      {children}
    </span>
  );
}
