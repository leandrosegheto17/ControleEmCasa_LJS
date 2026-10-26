import { useId } from 'react';
import { formatarMoeda } from '../formatacao/moeda';
import { Botao } from './base/Botao';
import { CampoValor } from './base/CampoValor';
import estiloCartao from './CartaoConta.module.css';
import estilo from './AjusteSaldo.module.css';

interface Props {
  /** `undefined` = campo ainda não preenchido. */
  saldoRealCentavos: number | undefined;
  aoMudar: (centavos: number) => void;
  /** Diferença calculada pelo servidor para o valor digitado; a tela não faz a conta. */
  diferencaCentavos: number | undefined;
  erroPrevia: string | undefined;
  aoAjustar: () => void;
  ajustando: boolean;
}

/** Campo "saldo que aparece no banco", prévia do ajuste e o botão que grava. */
export function AjusteSaldo({
  saldoRealCentavos,
  aoMudar,
  diferencaCentavos,
  erroPrevia,
  aoAjustar,
  ajustando,
}: Props) {
  const idTitulo = useId();
  return (
    <section className={estiloCartao.cartao} aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>Informar saldo real</h2>
      <div className={estilo.formulario}>
        <CampoValor rotulo="Saldo que aparece no banco" centavos={saldoRealCentavos ?? 0} aoMudar={aoMudar} />
        {diferencaCentavos !== undefined ? (
          <p className={estilo.nota} role="status">
            Ajuste de <span className="valor">{formatarMoeda(diferencaCentavos)}</span>. Não conta como receita nem
            despesa.
          </p>
        ) : null}
        {erroPrevia ? (
          <p className={estilo.nota} role="status">
            {erroPrevia}
          </p>
        ) : null}
        <div className={estilo.acao}>
          <Botao
            variante="secundario"
            salvando={ajustando}
            rotuloOcupado="Ajustando…"
            disabled={saldoRealCentavos === undefined}
            onClick={aoAjustar}
          >
            Ajustar saldo
          </Botao>
        </div>
      </div>
    </section>
  );
}
