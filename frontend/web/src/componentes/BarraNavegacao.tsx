import type { MouseEvent } from 'react';
import { Icone } from './base/Icone';
import { ITENS_NAVEGACAO } from './itensNavegacao';
import { LinkNavegacao } from './LinkNavegacao';
import estilos from './BarraNavegacao.module.css';

interface Props {
  aoLancar: () => void;
  mes?: string;
}

const ITENS = ITENS_NAVEGACAO.filter((item) => !item.soNoTrilho);
const POSICAO_LANCAR = 2;

/** Barra inferior do celular; o "+" central chama `aoLancar` em vez de navegar. */
export function BarraNavegacao({ aoLancar, mes }: Props) {
  function lancar(evento: MouseEvent) {
    evento.preventDefault();
    aoLancar();
  }
  const itens = ITENS.map((item) => (
    <li key={item.rota}>
      <LinkNavegacao item={item} mes={mes} />
    </li>
  ));
  itens.splice(
    POSICAO_LANCAR,
    0,
    <li key="lancar">
      <a href="/app/lancar" className={estilos.itemLancar} onClick={lancar}>
        <span className={estilos.botaoLancar}>
          <Icone nome="mais" />
        </span>
        Lançar
      </a>
    </li>,
  );
  return (
    <nav className={estilos.barra} aria-label="Navegação principal">
      <ul>{itens}</ul>
    </nav>
  );
}
