import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { Botao } from '../base/Botao';
import { BotaoLink } from '../base/BotaoLink';
import { CampoData } from '../base/CampoData';
import { CampoValor } from '../base/CampoValor';
import { EstadoVazio } from '../base/EstadoVazio';
import { focarPrimeiroErro } from '../base/focarPrimeiroErro';
import { Folha } from '../base/Folha';
import { Nota } from '../base/Nota';
import { Selecao } from '../base/Selecao';
import estilo from '../base/FolhaPagamento.module.css';

const FORMULARIO = 'form-pagto';

export interface DadosPagamento {
  valorCentavos: number;
  contaId: string;
  data: string;
}

interface Props {
  nomeCartao: string;
  /** Dia do vencimento; nulo quando a forma não o tem. */
  diaVencimento: number | null;
  /** Contas ativas, na ordem da API. */
  contas: { id: string; nome: string }[];
  /** Conta de pagamento do cartão; vale como padrão só se estiver entre as `contas`. */
  contaPadraoId: string | undefined;
  dataInicial: string;
  /** Erro do envio inteiro, no topo do formulário. */
  erro?: { texto: string; semConexao: boolean };
  salvando: boolean;
  aoConfirmar: (dados: DadosPagamento) => void;
  aoFechar: () => void;
}

/** Folha "Pagamento do cartão": valor, conta de origem e data; sem conta ativa, o atalho para cadastrar. */
export function FolhaPagamentoCartao({
  nomeCartao,
  diaVencimento,
  contas,
  contaPadraoId,
  dataInicial,
  erro,
  salvando,
  aoConfirmar,
  aoFechar,
}: Props) {
  const [valor, definirValor] = useState(0);
  const [contaEscolhida, definirConta] = useState<string | null>(null);
  const [data, definirData] = useState(dataInicial);
  const [erroValor, definirErroValor] = useState<string>();
  const [tentativasInvalidas, definirTentativasInvalidas] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (tentativasInvalidas > 0 && formulario.current) focarPrimeiroErro(formulario.current);
  }, [tentativasInvalidas]);

  const semContas = contas.length === 0;
  const padrao = contas.find((c) => c.id === contaPadraoId)?.id ?? contas[0]?.id ?? '';
  const contaId = contaEscolhida ?? padrao;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (valor <= 0) {
      definirErroValor('Informe um valor maior que zero.');
      definirTentativasInvalidas((n) => n + 1);
      return;
    }
    aoConfirmar({ valorCentavos: valor, contaId, data });
  }

  const rodape = semContas ? undefined : (
    <Botao variante="principal" tipo="submit" form={FORMULARIO} bloco salvando={salvando} rotuloOcupado="Registrando…">
      Registrar pagamento
    </Botao>
  );

  return (
    <Folha aberta aoFechar={aoFechar} titulo="Pagamento do cartão" rodape={rodape}>
      {semContas ? (
        <EstadoVazio
          icone="banco"
          nivel={3}
          semMargem
          titulo="Cadastre uma conta corrente"
          texto="O pagamento do cartão sai de uma conta. Cadastre a conta primeiro."
          acao={
            <BotaoLink para="/app/ajustes/contas/nova" variante="principal">
              Cadastrar conta
            </BotaoLink>
          }
        />
      ) : (
        <form id={FORMULARIO} ref={formulario} onSubmit={enviar} noValidate className={estilo.formulario}>
          {erro ? <AvisoErroTopo icone={erro.semConexao ? 'offline' : 'alerta'}>{erro.texto}</AvisoErroTopo> : null}
          <p className={estilo['item-sub']}>
            <span className={estilo['item-titulo']}>{nomeCartao}</span>
            {diaVencimento === null ? null : <>· vence dia {diaVencimento}</>}
          </p>
          <CampoValor
            rotulo="Valor pago"
            centavos={valor}
            aoMudar={(centavos) => {
              definirValor(centavos);
              definirErroValor(undefined);
            }}
            erro={erroValor}
          />
          <Selecao
            rotulo="Conta de origem"
            value={contaId}
            onChange={(e) => definirConta(e.target.value)}
            opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          />
          <CampoData rotulo="Data" value={data} onChange={(e) => definirData(e.target.value)} />
          <Nota>Sai do saldo da conta. Não conta como despesa em nenhum total, porque as compras já contaram.</Nota>
        </form>
      )}
    </Folha>
  );
}
