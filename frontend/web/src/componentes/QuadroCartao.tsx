import { useId } from 'react';
import { formatarMoeda } from '../formatacao/moeda';
import { LinkMais } from './base/LinkMais';
import estiloCartao from './CartaoConta.module.css';
import estilo from './QuadroCartao.module.css';

interface Props {
  nome: string;
  gastoMesCentavos: number;
  comprometidoFuturoCentavos: number;
  /** Nome do mês corrente em minúsculas ("outubro"); vazio enquanto o contexto carrega. */
  mes: string | undefined;
  /** Destino do link "Registrar pagamento do cartão". */
  destinoPagamento: string;
}

/** Totais do cartão de crédito, só leitura: os valores vêm prontos da view `formas_pagamento`. */
export function QuadroCartao({ nome, gastoMesCentavos, comprometidoFuturoCentavos, mes, destinoPagamento }: Props) {
  const idTitulo = useId();
  return (
    <section className={`${estiloCartao.cartao} ${estiloCartao.total}`} aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{nome}</h2>
      <dl className={estilo.linhas}>
        <div>
          <dt>{mes ? `Neste mês (parcelas com data em ${mes})` : 'Neste mês'}</dt>
          <dd className="valor">{formatarMoeda(gastoMesCentavos)}</dd>
        </div>
        <div>
          <dt>Próximos meses</dt>
          <dd className="valor">{formatarMoeda(comprometidoFuturoCentavos)}</dd>
        </div>
      </dl>
      <LinkMais para={destinoPagamento}>Registrar pagamento do cartão</LinkMais>
    </section>
  );
}
