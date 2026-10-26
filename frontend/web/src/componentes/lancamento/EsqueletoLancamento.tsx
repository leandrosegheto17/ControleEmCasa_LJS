import { Esqueleto } from '../base/Esqueleto';
import estilo from './EsqueletoLancamento.module.css';

/** Forma da tela enquanto o lançamento não chega: o resumo e três campos. */
export function EsqueletoLancamento() {
  return (
    <>
      <div className={estilo.cartao}>
        <Esqueleto variante="titulo" />
        <Esqueleto variante="valor" />
        <Esqueleto variante="linha-curta" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Esqueleto variante="bloco-titulo" />
          <div className={estilo.campo}>
            <Esqueleto variante="linha" />
          </div>
        </div>
      ))}
    </>
  );
}
