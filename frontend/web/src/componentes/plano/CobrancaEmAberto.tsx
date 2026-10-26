import { useId } from 'react';
import type { SaidaMeuPlano } from '@controle/contrato';
import { formatarData } from '../../formatacao/data';
import { formatarMoeda } from '../../formatacao/moeda';
import { Botao } from '../base/Botao';
import { Nota } from '../base/Nota';
import estilo from './Plano.module.css';

type Cobranca = NonNullable<SaidaMeuPlano['cobranca']>;

interface Props {
  cobranca: Cobranca;
  atualizando: boolean;
  aoCopiar: (codigo: string) => void;
  aoTentarDeNovo: () => void;
}

/**
 * Cobrança em aberto do titular, com o Pix copia-e-cola e o QR. Pix nulo = o serviço de cobrança não respondeu:
 * a tela oferece "Tentar de novo" em vez de um código vazio.
 */
export function CobrancaEmAberto({ cobranca, atualizando, aoCopiar, aoTentarDeNovo }: Props) {
  const id = useId();
  const vencida = cobranca.situacao === 'vencida';
  const codigo = cobranca.pix_copia_cola;
  return (
    <section aria-labelledby={id} className={estilo.secao}>
      <h2 id={id}>{vencida ? 'Cobrança vencida' : 'Cobrança em aberto'}</h2>
      <Nota icone={vencida}>
        {formatarMoeda(cobranca.valor_centavos)}, {vencida ? 'venceu' : 'vence'} em {formatarData(cobranca.vencimento)}.
        {vencida ? ' Pague para manter o Pro.' : ' Pague por Pix para ativar o Pro.'}
      </Nota>
      {codigo ? (
        <>
          <p className={estilo.codigo} aria-label="Pix copia e cola">
            {codigo}
          </p>
          {cobranca.qr_png_base64 ? (
            <img
              className={estilo.qr}
              src={`data:image/png;base64,${cobranca.qr_png_base64}`}
              alt="QR code do Pix"
              width={192}
              height={192}
            />
          ) : null}
          <div className={estilo.acoes}>
            <Botao variante="principal" icone="compartilhar" onClick={() => aoCopiar(codigo)}>
              Copiar código Pix
            </Botao>
          </div>
        </>
      ) : (
        <>
          <Nota icone>Não conseguimos gerar o Pix agora. A cobrança existe; tente de novo em instantes.</Nota>
          <div className={estilo.acoes}>
            <Botao
              variante="secundario"
              icone="recarregar"
              salvando={atualizando}
              rotuloOcupado="Buscando…"
              onClick={aoTentarDeNovo}
            >
              Tentar de novo
            </Botao>
          </div>
        </>
      )}
    </section>
  );
}
