import type { SaidaLarDetalhe } from '@controle/contrato';
import { GrupoMenu } from '../GrupoMenu';
import lista from '../base/Lista.module.css';

type Membro = SaidaLarDetalhe['membros'][number];

const PAPEL = { titular: 'Titular', membro: 'Membro' } as const;

/** Os membros ativos do lar (no máximo dois). O e-mail do outro membro não vem da API (PRD-TECNICO §2). */
export function ListaMembros({ membros }: { membros: readonly Membro[] }) {
  return (
    <GrupoMenu titulo="Membros">
      {membros.map((m) => (
        <li key={m.id}>
          <span className={lista.info}>
            <span className={lista.titulo}>{m.nome}</span>
            <span className={lista.sub}>
              {PAPEL[m.papel]}
              {m.sou_eu ? ' · você' : ''}
            </span>
          </span>
        </li>
      ))}
    </GrupoMenu>
  );
}
