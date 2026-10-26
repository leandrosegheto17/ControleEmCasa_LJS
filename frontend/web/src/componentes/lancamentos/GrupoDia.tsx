import type { ReactNode } from 'react';
import estilos from './GrupoDia.module.css';

interface Props {
  /** Id único na página, usado para nomear a região pelo título. */
  id: string;
  titulo: string;
  children: ReactNode;
}

/**
 * Região nomeada pelo título do dia. A lista fica dentro da região: `list` só aceita `listitem`
 * como filho direto, então não pode envolver os grupos.
 */
export function GrupoDia({ id, titulo, children }: Props) {
  return (
    <section className={estilos['grupo-dia']} aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      <div role="list">{children}</div>
    </section>
  );
}
