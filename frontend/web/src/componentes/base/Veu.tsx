import styles from './Veu.module.css';

interface Props {
  /** `dialogo` fica acima de uma folha aberta. */
  variante?: 'folha' | 'dialogo';
  /** Toque no véu (ponteiro). O teclado fecha por Esc; o véu continua fora da árvore de acessibilidade. */
  aoTocar?: () => void;
}

export function Veu({ variante = 'folha', aoTocar }: Props) {
  return (
    <div
      className={variante === 'dialogo' ? `${styles.veu} ${styles.dialogo}` : styles.veu}
      aria-hidden="true"
      onClick={aoTocar}
    />
  );
}
