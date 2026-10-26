import { linkEnvios } from '../formatacao/linksApp';
import { BotaoIcone } from './base/BotaoIcone';
import { SeletorMes } from './SeletorMes';
import estilos from './CabecalhoMes.module.css';

interface Props {
  /** 'AAAA-MM' */
  mes: string;
  aoMudarMes: (mes: string) => void;
  /** Itens na fila de envio; o ícone só aparece com pelo menos um. */
  pendentes: number;
  /** Texto lido antes do mês no h1 (ex.: "Lançamentos de "). */
  prefixoOculto?: string;
}

/** Cabeçalho das telas do mês: seletor, ícone de envios pendentes (se houver) e ajustes. */
export function CabecalhoMes({ mes, aoMudarMes, pendentes, prefixoOculto }: Props) {
  return (
    <header className={estilos.cabecalho}>
      <SeletorMes mes={mes} aoMudar={aoMudarMes} prefixoOculto={prefixoOculto} />
      <div className={estilos.acoes}>
        {pendentes > 0 ? (
          <BotaoIcone
            icone="envio"
            rotulo={`Envios pendentes: ${pendentes}`}
            para={linkEnvios(mes)}
            contador={pendentes}
          />
        ) : null}
        <BotaoIcone icone="ajustes" rotulo="Ajustes" para="/app/ajustes" />
      </div>
    </header>
  );
}
