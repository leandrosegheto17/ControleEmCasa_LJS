import { Esqueleto } from '../base/Esqueleto';
import estilos from './Meta.module.css';

/** Forma da tela enquanto a meta não chega: o resumo, o cartão de locais e o histórico. */
export function EsqueletoMeta() {
  return (
    <>
      <div className={estilos.grade}>
        <div className={estilos.secao}>
          <Esqueleto variante="titulo" />
          <Esqueleto variante="valor" />
          <Esqueleto variante="linha" />
          <Esqueleto variante="linha" />
          <Esqueleto variante="linha-curta" />
        </div>
        <div className={estilos.secao}>
          <Esqueleto variante="titulo" />
          <Esqueleto variante="linha" />
          <Esqueleto variante="linha" />
        </div>
      </div>
      <div className={`${estilos.secao} ${estilos.apos}`}>
        <Esqueleto variante="titulo" />
        <Esqueleto variante="linha" />
        <Esqueleto variante="linha" />
        <Esqueleto variante="linha" />
      </div>
    </>
  );
}
