import estilo from './Lista.module.css';

/** Item de `ul.lista` só de leitura: rótulo e valor. */
export function ItemValor({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <li>
      <span className={estilo.titulo}>{rotulo}</span>
      <span className={`${estilo.sub} valor`}>{valor}</span>
    </li>
  );
}
