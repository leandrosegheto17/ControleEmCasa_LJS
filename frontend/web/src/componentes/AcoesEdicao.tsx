import { useState } from 'react';
import { Botao } from './base/Botao';
import { DialogoConfirmacao } from './base/DialogoConfirmacao';

interface Acoes {
  emUso: boolean;
  salvando: boolean;
  arquivando: boolean;
  arquivar: () => void;
  cancelarEmUso: () => void;
  excluir: () => void;
}

interface Props {
  acoes: Acoes;
  podeExcluir: boolean;
  /** Rótulo do botão de arquivar quando o registro está em uso (ex.: "Arquivar conta"). */
  rotuloArquivarEmUso: string;
  tituloExclusao: string;
  textoExclusao: string;
}

/** Botões do rodapé das telas de edição (conta, forma, categoria) e a confirmação de exclusão. */
export function AcoesEdicao({ acoes, podeExcluir, rotuloArquivarEmUso, tituloExclusao, textoExclusao }: Props) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      {acoes.emUso ? (
        <>
          <Botao variante="principal" salvando={acoes.arquivando} rotuloOcupado="Arquivando…" onClick={acoes.arquivar}>
            {rotuloArquivarEmUso}
          </Botao>
          <Botao variante="secundario" onClick={acoes.cancelarEmUso}>
            Cancelar
          </Botao>
        </>
      ) : (
        <>
          <Botao variante="principal" tipo="submit" salvando={acoes.salvando}>
            Salvar
          </Botao>
          <Botao variante="secundario" salvando={acoes.arquivando} rotuloOcupado="Arquivando…" onClick={acoes.arquivar}>
            Arquivar
          </Botao>
          {podeExcluir ? (
            <Botao variante="perigo" icone="lixo" onClick={() => setConfirmando(true)}>
              Excluir
            </Botao>
          ) : null}
        </>
      )}
      <DialogoConfirmacao
        aberto={confirmando}
        titulo={tituloExclusao}
        texto={textoExclusao}
        rotuloConfirmar="Excluir"
        variante="destrutiva"
        iconeConfirmar="lixo"
        aoConfirmar={() => {
          setConfirmando(false);
          acoes.excluir();
        }}
        aoCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
