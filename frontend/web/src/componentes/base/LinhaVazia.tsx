import type { ReactNode } from 'react';
import estilos from './Estado.module.css';

/** Texto de cartão sem dados (ex.: "Nenhuma meta cadastrada"). */
export function LinhaVazia({ children }: { children: ReactNode }) {
  return <p className={estilos['estado-linha']}>{children}</p>;
}
