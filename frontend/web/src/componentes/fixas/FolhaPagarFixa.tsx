import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import type { SituacaoOcorrencia } from '../../comum/enums';
import { useMemo, type FormEvent } from 'react';
import { periodoDePagamento } from '../../formatacao/data';
import { formatarMoeda } from '../../formatacao/moeda';
import { ROTULO_TIPO_FORMA } from '../../rotulos/tipoForma';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { Botao } from '../base/Botao';
import { BotaoForma } from '../base/BotaoForma';
import { BotaoLink } from '../base/BotaoLink';
import { CampoData } from '../base/CampoData';
import { CampoValor } from '../base/CampoValor';
import { EstadoVazio } from '../base/EstadoVazio';
import { Folha } from '../base/Folha';
import { Nota } from '../base/Nota';
import { textoVencimento } from './textoVencimento';
import estilo from '../base/FolhaPagamento.module.css';

const FORMULARIO = 'form-pagar';

interface Props {
  ocorrencia: {
    descricao: string;
    categoria: string;
    situacao: SituacaoOcorrencia;
    vencimento: string;
    valor_previsto_centavos: number;
  };
  /** Nome do mês da nota do crédito, em minúsculas ("outubro"). */
  nomeMes: string;
  /** Nome de quem paga, citado na ajuda sobre o que o outro membro vê. */
  nomeMembro: string;
  formas: DadosLancamento['formas'];
  formaId: string;
  valorCentavos: number;
  data: string;
  /** Erro do envio, no topo do formulário. */
  erro?: { texto: string; semConexao: boolean };
  salvando: boolean;
  aoMudarForma: (id: string) => void;
  aoMudarValor: (centavos: number) => void;
  aoMudarData: (data: string) => void;
  aoConfirmar: () => void;
  aoFechar: () => void;
}

/** Folha "Marcar como paga": forma, valor pago e data; sem forma cadastrada, o atalho para cadastrar. */
export function FolhaPagarFixa({
  ocorrencia,
  nomeMes,
  nomeMembro,
  formas,
  formaId,
  valorCentavos,
  data,
  erro,
  salvando,
  aoMudarForma,
  aoMudarValor,
  aoMudarData,
  aoConfirmar,
  aoFechar,
}: Props) {
  const semFormas = formas.length === 0;
  const periodo = useMemo(() => periodoDePagamento(), []);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    aoConfirmar();
  }

  const rodape = semFormas ? undefined : (
    <Botao variante="principal" tipo="submit" form={FORMULARIO} bloco salvando={salvando} rotuloOcupado="Confirmando…">
      {erro?.semConexao ? 'Tentar de novo' : 'Confirmar pagamento'}
    </Botao>
  );

  return (
    <Folha aberta aoFechar={aoFechar} titulo="Marcar como paga" rodape={rodape}>
      {semFormas ? (
        <EstadoVazio
          icone="cartao"
          nivel={3}
          semMargem
          titulo="Você ainda não tem forma de pagamento"
          texto="Cadastre uma forma (Pix, Débito ou cartão) para registrar quem pagou."
          acao={
            <BotaoLink para="/app/ajustes/formas/nova" variante="principal">
              Cadastrar forma
            </BotaoLink>
          }
        />
      ) : (
        <form id={FORMULARIO} onSubmit={enviar} noValidate className={estilo.formulario}>
          {erro ? <AvisoErroTopo icone={erro.semConexao ? 'offline' : 'alerta'}>{erro.texto}</AvisoErroTopo> : null}
          <p className={estilo['item-sub']}>
            <span className={estilo['item-titulo']}>{ocorrencia.descricao}</span>· {ocorrencia.categoria} ·{' '}
            {textoVencimento(ocorrencia.situacao, ocorrencia.vencimento)}
          </p>
          <BotaoForma
            rotulo="Forma de pagamento"
            opcoes={formas.map((f) => ({ id: f.id, nome: f.nome, detalhe: ROTULO_TIPO_FORMA[f.tipo].texto }))}
            valor={formaId}
            aoEscolher={aoMudarForma}
            ajuda={`Só você vê a forma e a conta. O outro membro vê "Paga por ${nomeMembro}".`}
          />
          <CampoValor
            rotulo="Valor pago"
            centavos={valorCentavos}
            aoMudar={aoMudarValor}
            ajuda={`Previsto: ${formatarMoeda(ocorrencia.valor_previsto_centavos)}`}
          />
          <CampoData
            rotulo="Data do pagamento"
            value={data}
            min={periodo.min}
            max={periodo.max}
            onChange={(e) => aoMudarData(e.target.value)}
          />
          <Nota>
            Se pagar no cartão de crédito: conta em {nomeMes} na casa e aparece no cartão no próximo vencimento.
          </Nota>
        </form>
      )}
    </Folha>
  );
}
