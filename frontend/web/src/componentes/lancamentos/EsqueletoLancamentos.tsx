import estilos from './EsqueletoLancamentos.module.css';

const GRUPOS = [2, 3];

/** Total e dois grupos de linhas. Decorativo (fica dentro de CarregandoComAtraso). */
export function EsqueletoLancamentos() {
  return (
    <>
      <div className={`${estilos.esqueleto} ${estilos.total}`} />
      {GRUPOS.map((linhas, g) => (
        <div key={g}>
          <div className={`${estilos.esqueleto} ${estilos.titulo}`} />
          {Array.from({ length: linhas }, (_, i) => (
            <div key={i} className={`${estilos.esqueleto} ${estilos.linha}`} />
          ))}
        </div>
      ))}
    </>
  );
}
