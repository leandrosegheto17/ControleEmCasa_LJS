import { DialogoConfirmacao } from '../../componentes/base/DialogoConfirmacao';
import { useSairDoLar } from '../../ganchos/useLar';
import { TEXTO_SAIDA, TITULO_SAIDA } from '../../rotulos/lar';
import { mensagemErro } from '../../rotulos/mensagensErro';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

/**
 * Confirmação e chamada da saída do membro (CA-23.12, CA-23.13). No sucesso o gancho relê a sessão e a guarda leva
 * ao primeiro acesso, onde aparece "Você saiu da casa". `registro_invalido` e `sem_lar` também relêem a sessão, sem
 * erro na tela. Rede e servidor deixam a confirmação aberta com o erro. A ação é só online: nada vai para a fila.
 */
export function SairDaCasaConectado({ aberto, aoFechar }: Props) {
  const sair = useSairDoLar();

  function fechar() {
    sair.reset();
    aoFechar();
  }

  function confirmar() {
    if (sair.isPending) return;
    sair.mutate(undefined, { onSuccess: fechar });
  }

  return (
    <DialogoConfirmacao
      aberto={aberto}
      titulo={TITULO_SAIDA}
      texto={TEXTO_SAIDA}
      rotuloConfirmar="Sair da casa"
      variante="destrutiva"
      ocupado={sair.isPending}
      erro={sair.error ? mensagemErro(sair.error) : undefined}
      fecharNoVeu
      aoConfirmar={confirmar}
      aoCancelar={fechar}
    />
  );
}
