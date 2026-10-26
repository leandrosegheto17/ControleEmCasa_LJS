import type { SaidaLancamento as Lancamento } from '@controle/contrato';
import { formatarDataCurta, hojeEmSaoPaulo } from '../../formatacao/data';
import { formatarTituloLancamento } from '../../formatacao/lancamento';
import { SeloEscopo } from '../base/SeloEscopo';
import { ValorDestaque } from '../base/ValorDestaque';
import estilo from './ResumoLancamento.module.css';

interface Props {
  lancamento: Lancamento;
  membroAtual: { nome: string };
}

/** Dia e mês do instante em America/Sao_Paulo, qualquer que seja o fuso do texto ISO. */
const diaMes = (instante: string) => formatarDataCurta(hojeEmSaoPaulo(new Date(instante)));

/** A parcela em foco: título, valor da parcela, escopo, quem pagou e quem alterou por último. */
export function ResumoLancamento({ lancamento, membroAtual }: Props) {
  const { descricao, categoria, escopo, num_parcelas, parcela_em_foco, parcelas, pagador, alterado_por, alterado_em } =
    lancamento;
  const emFoco = parcelas.find((p) => p.numero === parcela_em_foco) ?? parcelas[0];
  const titulo = formatarTituloLancamento(descricao, categoria.nome, parcela_em_foco, num_parcelas);

  return (
    <section className={estilo.resumo} aria-label="Resumo">
      <p className={estilo.titulo}>{titulo}</p>
      <ValorDestaque
        centavos={emFoco?.valor_centavos ?? lancamento.valor_total_centavos}
        rotulo={num_parcelas > 1 ? `parcela ${parcela_em_foco} de ${num_parcelas}` : undefined}
      />
      <p className={estilo.sub}>
        <SeloEscopo escopo={escopo} />
        <span>
          · {categoria.nome}
          {escopo === 'conjunto' ? ` · Pago por ${pagador.sou_eu ? 'você' : pagador.nome}` : ''}
        </span>
      </p>
      {alterado_por && alterado_em ? (
        <p className={estilo.sub}>
          Alterado por último por {alterado_por.nome === membroAtual.nome ? 'você' : alterado_por.nome} em{' '}
          {diaMes(alterado_em)}
        </p>
      ) : null}
    </section>
  );
}
