import type { KeyboardEvent } from 'react';
import { formatarMes, mesAnterior, mesSeguinte } from '../formatacao/mes';
import { BotaoIcone } from './base/BotaoIcone';
import estilos from './SeletorMes.module.css';

interface Props {
  /** 'AAAA-MM' */
  mes: string;
  aoMudar: (mes: string) => void;
  /** Texto lido por leitor de tela antes do mês, dentro do h1. */
  prefixoOculto?: string;
  /** `span` quando a tela já tem o seu `h1` (padrão: o mês é o `h1`). */
  elemento?: 'h1' | 'span';
}

/** ‹ Mês › controlado; as setas do teclado valem só com o foco dentro do seletor. */
export function SeletorMes({ mes, aoMudar, prefixoOculto, elemento = 'h1' }: Props) {
  const anterior = mesAnterior(mes);
  const seguinte = mesSeguinte(mes);

  function aoTeclar(evento: KeyboardEvent) {
    if (evento.key === 'ArrowLeft') aoMudar(anterior);
    else if (evento.key === 'ArrowRight') aoMudar(seguinte);
  }

  const Mes = elemento;

  return (
    <div className={estilos.seletor} onKeyDown={aoTeclar}>
      <BotaoIcone
        icone="esq"
        rotulo={`Mês anterior: ${formatarMes(anterior, { minuscula: true })}`}
        onClick={() => aoMudar(anterior)}
      />
      <Mes className={estilos.mes}>
        {prefixoOculto ? (
          <>
            <span className="visualmente-oculto">{prefixoOculto.trimEnd()}</span>{' '}
          </>
        ) : null}
        {formatarMes(mes)}
      </Mes>
      <BotaoIcone
        icone="dir"
        rotulo={`Próximo mês: ${formatarMes(seguinte, { minuscula: true })}`}
        onClick={() => aoMudar(seguinte)}
      />
    </div>
  );
}
