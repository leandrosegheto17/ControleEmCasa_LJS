import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { Icone, type NomeIcone } from './Icone';
import styles from './BotaoIcone.module.css';

type PropsBotao = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  icone: NomeIcone;
  /** Nome acessível: o botão não tem texto visível. */
  rotulo: string;
  para?: undefined;
};

interface PropsLink {
  icone: NomeIcone;
  rotulo: string;
  /** Destino de navegação: renderiza um link com a mesma aparência. */
  para: string;
  className?: string;
  /** Número sobre o ícone (itens pendentes); o nome acessível já deve trazê-lo. */
  contador?: number;
}

export function BotaoIcone(props: PropsBotao | PropsLink) {
  const { icone, rotulo, className } = props;
  const classe = className ? `${styles.botao} ${className}` : styles.botao;
  if (props.para !== undefined) {
    return (
      <Link to={props.para} className={classe} aria-label={rotulo}>
        <Icone nome={icone} />
        {props.contador === undefined ? null : (
          <span className={styles.contador} aria-hidden="true">
            {props.contador}
          </span>
        )}
      </Link>
    );
  }
  const { icone: _i, rotulo: _r, para: _p, className: _c, type = 'button', ...resto } = props;
  return (
    <button {...resto} type={type} className={classe} aria-label={rotulo}>
      <Icone nome={icone} />
    </button>
  );
}
