import estilo from './EsqueletoLista.module.css';

/** Esqueleto de uma lista de linhas simples; a última é mais curta. Decorativo. */
export function EsqueletoLista({ linhas }: { linhas: number }) {
  return (
    <div className={estilo.lista} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={i === linhas - 1 ? estilo.curta : estilo.linha} />
      ))}
    </div>
  );
}
