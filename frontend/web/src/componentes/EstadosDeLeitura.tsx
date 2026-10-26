import type { ReactNode } from 'react';
import { CarregandoComAtraso } from './base/CarregandoComAtraso';
import { EstadoErro } from './base/EstadoErro';
import { Faixa } from './base/Faixa';
import { formatarHora } from '../formatacao/data';
import type { LeituraComCache } from '../tipos/leitura';

interface Props<T> {
  leitura: LeituraComCache<T>;
  esqueleto: ReactNode;
  aoTentarDeNovo: () => void;
  /** Texto lido enquanto o esqueleto aparece. */
  anuncioCarregando?: string;
  /** Título e texto do erro sem dado em cache; sem eles valem os padrões de `EstadoErro`. */
  tituloErro?: string;
  textoErro?: string;
  children: (dados: T) => ReactNode;
}

/** Os quatro caminhos de uma leitura. O estado vazio continua na tela. */
export function EstadosDeLeitura<T>({
  leitura,
  esqueleto,
  aoTentarDeNovo,
  anuncioCarregando,
  tituloErro,
  textoErro,
  children,
}: Props<T>) {
  const { situacao, dados, atualizadoEm } = leitura;
  if (situacao === 'carregando')
    return <CarregandoComAtraso anuncio={anuncioCarregando}>{esqueleto}</CarregandoComAtraso>;
  if (dados === undefined) return <EstadoErro titulo={tituloErro} texto={textoErro} aoTentarDeNovo={aoTentarDeNovo} />;
  return (
    <>
      {situacao === 'cache' ? <Faixa variante="cache" hora={formatarHora(atualizadoEm)} /> : null}
      {children(dados)}
    </>
  );
}
