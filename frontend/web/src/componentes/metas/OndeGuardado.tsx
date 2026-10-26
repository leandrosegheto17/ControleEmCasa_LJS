import { useId } from 'react';
import type { SaidaLinhaMetas as LinhaMetas } from '@controle/contrato';
import { formatarMoeda } from '../../formatacao/moeda';
import listaEstilo from '../base/Lista.module.css';
import estilos from './Meta.module.css';

/** Quanto da meta está em cada local, na ordem da API. */
export function OndeGuardado({ locais }: { locais: NonNullable<LinhaMetas['por_local']> }) {
  const id = useId();
  return (
    <section className={estilos.secao} aria-labelledby={id}>
      <h2 id={id}>Onde está guardado</h2>
      <ul className={listaEstilo.lista}>
        {locais.map((l) => (
          <li key={l.local}>
            <span className={listaEstilo.titulo}>{l.local}</span>
            <span className="valor">{formatarMoeda(l.guardado_centavos)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
