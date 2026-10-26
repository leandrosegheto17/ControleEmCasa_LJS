import { useState } from 'react';
import type { TipoForma } from '../../comum/enums';
import { Botao } from '../base/Botao';
import { GrupoChips } from '../base/GrupoChips';
import estilosChip from '../base/Chips.module.css';
import estilo from './SecaoParcelas.module.css';

interface Props {
  tipoForma: TipoForma | null;
  valor: number;
  aoMudar: (parcelas: number) => void;
}

const FIXAS = [1, 2, 3, 4, 5, 6, 10, 12];
const MINIMO = 1;
const MAXIMO = 24;

const opcoes = FIXAS.map((n) => ({ valor: String(n), conteudo: n === 1 ? 'À vista' : `${n}x` }));

/** Os limites 1 a 24 só guiam a entrada; quem garante o valor é o servidor. */
export function SecaoParcelas({ tipoForma, valor, aoMudar }: Props) {
  if (tipoForma !== 'credito') return null;
  return <ParcelasDoCredito valor={valor} aoMudar={aoMudar} />;
}

/** Montada só no Crédito: ao trocar de forma o "Outro" aberto é descartado junto com o componente. */
function ParcelasDoCredito({ valor, aoMudar }: Omit<Props, 'tipoForma'>) {
  const [outro, setOutro] = useState(() => !FIXAS.includes(valor));

  const passar = (n: number) => aoMudar(Math.min(MAXIMO, Math.max(MINIMO, n)));

  return (
    <div className={estilo.secao}>
      <GrupoChips
        nome="parcelas"
        rotulo="Parcelas"
        variante="linha"
        opcoes={opcoes}
        valor={outro ? '' : String(valor)}
        aoMudar={(v) => {
          setOutro(false);
          aoMudar(Number(v));
        }}
        extra={
          <button
            type="button"
            className={`${estilosChip.chip} ${outro ? estilosChip['chip-escolhida'] : ''}`}
            aria-expanded={outro}
            onClick={() => setOutro(true)}
          >
            Outro
          </button>
        }
      />
      {outro ? (
        <div className={estilo.passo}>
          <Botao variante="secundario" aria-label="Diminuir parcelas" onClick={() => passar(valor - 1)}>
            −
          </Botao>
          <span className={estilo.numero} aria-live="polite">
            {valor}x
          </span>
          <Botao variante="secundario" aria-label="Aumentar parcelas" onClick={() => passar(valor + 1)}>
            +
          </Botao>
        </div>
      ) : null}
      <p className={estilo.ajuda}>Entra a partir do próximo vencimento do cartão.</p>
    </div>
  );
}
