import type { SaidaLancamento as Lancamento } from '@controle/contrato';
import { useState } from 'react';
import { Botao } from '../base/Botao';
import { DialogoConfirmacao } from '../base/DialogoConfirmacao';
import { textoExclusao } from './textoExclusao';

interface Props {
  lancamento: Lancamento;
  /** Resolve quando a tentativa termina (com sucesso ou não); o diálogo fecha em seguida. */
  aoExcluir: () => Promise<void>;
}

/** Botão "Excluir" e o diálogo que pede a confirmação; só o botão do diálogo chama `aoExcluir`. */
export function ExcluirLancamento({ lancamento, aoExcluir }: Props) {
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const { titulo, texto } = textoExclusao({
    descricao: lancamento.descricao ?? null,
    categoria: lancamento.categoria.nome,
    valorTotalCentavos: lancamento.valor_total_centavos,
    numParcelas: lancamento.num_parcelas,
    escopo: lancamento.escopo,
    tipo: lancamento.tipo,
  });

  async function confirmar() {
    setExcluindo(true);
    try {
      await aoExcluir();
    } finally {
      setExcluindo(false);
      setAberto(false);
    }
  }

  return (
    <>
      <Botao variante="perigo" icone="lixo" tipo="button" onClick={() => setAberto(true)}>
        Excluir
      </Botao>
      <DialogoConfirmacao
        aberto={aberto}
        titulo={titulo}
        texto={texto}
        rotuloConfirmar="Excluir"
        iconeConfirmar="lixo"
        variante="destrutiva"
        ocupado={excluindo}
        aoConfirmar={() => void confirmar()}
        aoCancelar={() => setAberto(false)}
      />
    </>
  );
}
