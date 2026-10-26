import type { ReactNode } from 'react';
import { TEXTO_FAIXA_OFFLINE } from '../../rotulos/textosConexao';
import { Icone, type NomeIcone } from './Icone';
import estilos from './Faixa.module.css';

type Variante = 'offline' | 'pendentes' | 'instalar' | 'cache' | 'plano' | 'encerramento';

interface Props {
  variante: Variante;
  /** Sem texto, a variante `offline` usa o texto padrão. */
  children?: ReactNode;
  /** Botões ou links da faixa (Ver, Instalar, Dispensar), montados por quem chama. */
  acoes?: ReactNode;
  /** Hora já formatada; só na variante `cache`. */
  hora?: string;
}

const ICONE: Record<Variante, NomeIcone> = {
  offline: 'envio',
  pendentes: 'envio',
  instalar: 'adicionar',
  cache: 'relogio',
  plano: 'alerta',
  encerramento: 'alerta',
};

const padrao = (variante: Variante) => (variante === 'offline' ? TEXTO_FAIXA_OFFLINE : null);

/** Faixa de instalar tem controles: região comum, não região viva. As demais só informam. */
export function Faixa({ variante, children, acoes, hora }: Props) {
  // `encerramento` é o único aviso em tom de erro: o lar vai ser apagado (RN-26).
  const destaque =
    variante === 'encerramento'
      ? ` ${estilos['faixa-erro']}`
      : variante === 'offline' || variante === 'pendentes' || variante === 'plano'
        ? ` ${estilos['faixa-aviso']}`
        : '';
  const papel = variante === 'instalar' ? { role: 'region', 'aria-label': 'Instalar o app' } : { role: 'status' };
  return (
    <div className={`${estilos.faixa}${destaque}`} {...papel}>
      <Icone nome={ICONE[variante]} />
      <span className={estilos['texto-faixa']}>
        {variante === 'cache' ? `Mostrando dados de ${hora ?? ''}` : (children ?? padrao(variante))}
      </span>
      {acoes ? <div className={estilos.acoes}>{acoes}</div> : null}
    </div>
  );
}
