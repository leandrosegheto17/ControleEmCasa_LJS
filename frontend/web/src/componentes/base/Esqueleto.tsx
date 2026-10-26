import estilos from './Esqueleto.module.css';

export type VarianteEsqueleto = 'titulo' | 'valor' | 'linha' | 'linha-curta' | 'bloco-titulo';

interface Props {
  variante: VarianteEsqueleto;
}

/** Peça de esqueleto; a forma de cada tela é montada pela tela. Decorativa (fica dentro de CarregandoComAtraso). */
export function Esqueleto({ variante }: Props) {
  return <div className={`${estilos.esqueleto} ${estilos[variante]}`} />;
}
