import { Link } from 'react-router';
import { Icone, type NomeIcone } from './Icone';
import estilo from './Botao.module.css';

interface Props {
  para: string;
  variante: 'principal' | 'secundario' | 'texto';
  icone?: NomeIcone;
  children: string;
  /** Nome acessível quando precisa dizer mais que o texto (ex.: qual item). */
  rotulo?: string;
  aoClicar?: () => void;
}

/** Link de navegação com a aparência de `Botao`. */
export function BotaoLink({ para, variante, icone, children, rotulo, aoClicar }: Props) {
  return (
    <Link to={para} aria-label={rotulo} onClick={aoClicar} className={`${estilo.botao} ${estilo[variante]}`}>
      {icone ? <Icone nome={icone} /> : null}
      {children}
    </Link>
  );
}
