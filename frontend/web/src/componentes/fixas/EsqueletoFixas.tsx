import estilo from './EsqueletoFixas.module.css';

/** Cartão-esqueleto: título e quatro linhas, a última mais curta. Decorativo. */
export function EsqueletoFixas() {
  return (
    <div className={estilo.cartao}>
      <div className={estilo.titulo} />
      <div className={estilo.linha} />
      <div className={estilo.linha} />
      <div className={estilo.linha} />
      <div className={`${estilo.linha} ${estilo.curta}`} />
    </div>
  );
}
