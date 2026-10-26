import { useId, useState, type FormEvent } from 'react';
import { cpfCnpjValido, mascararCpfCnpj } from '../../comum/cpfCnpj';
import { formatarMoeda } from '../../formatacao/moeda';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { Botao } from '../base/Botao';
import { CampoTexto } from '../base/CampoTexto';
import { Nota } from '../base/Nota';
import estilo from './Plano.module.css';

interface Props {
  precoCentavos: number;
  salvando: boolean;
  /** Erro do envio inteiro (sem rede, serviço indisponível), no topo do formulário. */
  erro?: string;
  /** O servidor recusou o CPF/CNPJ (`valor_invalido`). */
  cpfRecusado?: boolean;
  /** Qualquer edição do campo: o erro do servidor deixa de valer. */
  aoEditar: () => void;
  aoAssinar: (cpfCnpj: string) => void;
}

/**
 * Assinar o Pro: pede o CPF ou CNPJ do titular (exigência do Asaas). O valor fica só no estado do formulário: não vai a
 * `localStorage`, fila offline, log nem URL, e o campo não oferece autopreenchimento (CA-24.11).
 */
export function FormularioAssinar({ precoCentavos, salvando, erro, cpfRecusado, aoEditar, aoAssinar }: Props) {
  const idTitulo = useId();
  const [texto, setTexto] = useState('');
  const [erroLocal, setErroLocal] = useState<string | undefined>();

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!cpfCnpjValido(texto)) {
      setErroLocal('Informe um CPF ou CNPJ válido.');
      return;
    }
    aoAssinar(texto);
  }

  return (
    <section aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>Assinar o Pro</h2>
      <Nota>
        {formatarMoeda(precoCentavos)} por mês, por casa, pagos por Pix. O Pro libera a edição de orçamento e metas para
        os dois membros.
      </Nota>
      <form className={estilo.formulario} onSubmit={enviar} noValidate>
        {erro ? <AvisoErroTopo>{erro}</AvisoErroTopo> : null}
        <CampoTexto
          id="cpf-cnpj"
          rotulo="CPF ou CNPJ do titular"
          inputMode="numeric"
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(mascararCpfCnpj(e.target.value));
            setErroLocal(undefined);
            aoEditar();
          }}
          ajuda="Exigido pelo serviço de cobrança para emitir o Pix. Não guardamos este número."
          erro={erroLocal ?? (cpfRecusado ? 'Confira o CPF ou CNPJ informado.' : undefined)}
        />
        <Botao variante="principal" tipo="submit" salvando={salvando} rotuloOcupado="Assinando…">
          Assinar o Pro
        </Botao>
      </form>
    </section>
  );
}
