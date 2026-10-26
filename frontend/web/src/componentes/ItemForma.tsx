import type { SaidaLinhaFormasPagamento as LinhaFormasPagamento } from '@controle/contrato';
import { formatarMoeda } from '../formatacao/moeda';
import { ItemLink } from './base/ItemLink';
import lista from './base/Lista.module.css';
import { SeloPreferida } from './base/SeloPreferida';

function subtitulo(forma: LinhaFormasPagamento): string | undefined {
  if (forma.tipo === 'credito') return forma.dia_vencimento === null ? undefined : `vence dia ${forma.dia_vencimento}`;
  return forma.conta ? `conta ${forma.conta.nome}` : undefined;
}

function TotaisCartao({ forma }: { forma: LinhaFormasPagamento }) {
  if (forma.gasto_mes_centavos === null || forma.comprometido_futuro_centavos === null) return null;
  return (
    <span className={lista.direita}>
      <span className="valor">Neste mês {formatarMoeda(forma.gasto_mes_centavos)}</span>
      <span className={`${lista.sub} valor`}>Próximos meses {formatarMoeda(forma.comprometido_futuro_centavos)}</span>
    </span>
  );
}

/** Linha de uma forma de pagamento; os totais do cartão vêm prontos da API. */
export function ItemForma({ forma }: { forma: LinhaFormasPagamento }) {
  const direita =
    forma.tipo === 'credito' ? <TotaisCartao forma={forma} /> : forma.preferida ? <SeloPreferida /> : null;
  return (
    <ItemLink
      icone={forma.tipo === 'credito' ? 'cartao' : undefined}
      rotulo={forma.nome}
      subtitulo={subtitulo(forma)}
      para={`/app/ajustes/formas/${forma.id}`}
      direita={direita}
    />
  );
}
