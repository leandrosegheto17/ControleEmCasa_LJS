import type { SaidaLarDetalhe } from '@controle/contrato';
import { useQueryClient } from '@tanstack/react-query';
import { DialogoConfirmacao } from '../../componentes/base/DialogoConfirmacao';
import { useAviso } from '../../componentes/base/useAviso';
import { CHAVES } from '../../ganchos/chavesConsulta';
import { useRemoverMembro } from '../../ganchos/useLar';
import { AVISO_JA_NAO_ESTA, AVISO_MEMBRO_REMOVIDO, textoRemocao, tituloRemocao } from '../../rotulos/lar';
import { mensagemErro } from '../../rotulos/mensagensErro';

type Membro = SaidaLarDetalhe['membros'][number];

interface Props {
  /** Membro cuja remoção o titular pediu; `null` = confirmação fechada. */
  membro: Membro | null;
  aoFechar: () => void;
}

/**
 * Confirmação e chamada da remoção do membro pelo titular (CA-23.14). Sucesso relê o lar e avisa; `registro_invalido`
 * (o membro já saiu) é tratado como resolvido; rede e servidor deixam a confirmação aberta com o erro. A ação é só
 * online: o gancho roda sem pausa e nada vai para a fila do aparelho.
 */
export function RemoverMembroConectado({ membro, aoFechar }: Props) {
  const remover = useRemoverMembro();
  const cliente = useQueryClient();
  const { mostrar } = useAviso();

  function fechar() {
    remover.reset();
    aoFechar();
  }

  function confirmar() {
    if (!membro || remover.isPending) return;
    remover.mutate(membro.id, {
      onSuccess: () => {
        mostrar('sucesso', AVISO_MEMBRO_REMOVIDO);
        fechar();
      },
      onError: (erro) => {
        if (erro.tipo === 'regra' && erro.codigo === 'registro_invalido') {
          void cliente.invalidateQueries({ queryKey: CHAVES.lar });
          mostrar('sucesso', AVISO_JA_NAO_ESTA);
          fechar();
        }
      },
    });
  }

  const erro = remover.error;
  const textoErro =
    erro && !(erro.tipo === 'regra' && erro.codigo === 'registro_invalido') ? mensagemErro(erro) : undefined;

  return (
    <DialogoConfirmacao
      aberto={membro !== null}
      titulo={membro ? tituloRemocao(membro.nome) : ''}
      texto={membro ? textoRemocao(membro.nome) : ''}
      rotuloConfirmar="Remover"
      variante="destrutiva"
      ocupado={remover.isPending}
      erro={textoErro}
      fecharNoVeu
      aoConfirmar={confirmar}
      aoCancelar={fechar}
    />
  );
}
