import type { ReactNode } from 'react';
import estilos from './GradeOrcamento.module.css';

/** Cartões do orçamento: uma coluna no celular, duas no PC. */
export function GradeOrcamento({ children }: { children: ReactNode }) {
  return <div className={estilos.grade}>{children}</div>;
}
