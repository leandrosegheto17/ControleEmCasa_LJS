import type { MouseEvent } from 'react';
import { Icone } from './base/Icone';
import { ITENS_NAVEGACAO } from './itensNavegacao';
import { LinkNavegacao } from './LinkNavegacao';
import estilos from './TrilhoNavegacao.module.css';

interface Props {
  aoLancar: () => void;
  mes?: string;
}

/** Trilho lateral do PC (a partir de 1024 px), com "Lançar" no topo e Ajustes. */
export function TrilhoNavegacao({ aoLancar, mes }: Props) {
  function lancar(evento: MouseEvent) {
    evento.preventDefault();
    aoLancar();
  }
  return (
    <nav className={estilos.trilho} aria-label="Navegação principal">
      <span className={estilos.marca}>Controle em Casa</span>
      <a href="/app/lancar" className={estilos.botaoLancar} onClick={lancar}>
        <Icone nome="mais" />
        Lançar
      </a>
      <ul>
        {ITENS_NAVEGACAO.map((item) => (
          <li key={item.rota}>
            <LinkNavegacao item={item} mes={mes} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
