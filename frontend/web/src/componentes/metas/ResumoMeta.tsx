import type { ReactNode } from 'react';
import type { SaidaLinhaMetas as LinhaMetas } from '@controle/contrato';
import { formatarMesCurto } from '../../formatacao/mes';
import { formatarMoeda } from '../../formatacao/moeda';
import { BarraProgresso } from '../base/BarraProgresso';
import { CartaoResumo } from '../base/CartaoResumo';
import { ValorDestaque } from '../base/ValorDestaque';
import { LinhasValores } from '../inicio/LinhasValores';
import estilos from './Meta.module.css';

interface Props {
  meta: LinhaMetas;
  /** Ações do cartão (Aportar e Retirar); ficam de fora quando a meta ainda não tem movimentos. */
  acoes?: ReactNode;
}

/** O quanto falta, o progresso e os números da meta, como a API os entrega. */
export function ResumoMeta({ meta, acoes }: Props) {
  const bloco = meta.escopo === 'conjunto' ? 'casa' : 'eu';
  const linhas = [
    { rotulo: 'Guardado', valor: formatarMoeda(meta.guardado_centavos) },
    { rotulo: 'Alvo', valor: formatarMoeda(meta.alvo_centavos) },
    ...(meta.prazo === null ? [] : [{ rotulo: 'Prazo', valor: formatarMesCurto(meta.prazo), texto: true }]),
    ...(meta.mensal_necessario_centavos === null
      ? []
      : [{ rotulo: 'Necessário por mês', valor: formatarMoeda(meta.mensal_necessario_centavos) }]),
  ];

  return (
    <CartaoResumo titulo="Faltam" total secao bloco={bloco} estado="dado" textoVazio="">
      <ValorDestaque centavos={meta.falta_centavos} rotulo={`${meta.percentual}%`} />
      <BarraProgresso percentual={meta.percentual} situacao={meta.atingida ? 'atingida' : bloco} rotulo={meta.nome} />
      <LinhasValores linhas={linhas} />
      {acoes ? <div className={estilos.acoes}>{acoes}</div> : null}
    </CartaoResumo>
  );
}
