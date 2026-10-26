import styles from './Veu.module.css';

interface Props {
  /** `dialogo` fica acima de uma folha aberta. */
  variante?: 'folha' | 'dialogo';
}

export function Veu({ variante = 'folha' }: Props) {
  return <div className={variante === 'dialogo' ? `${styles.veu} ${styles.dialogo}` : styles.veu} aria-hidden="true" />;
}
