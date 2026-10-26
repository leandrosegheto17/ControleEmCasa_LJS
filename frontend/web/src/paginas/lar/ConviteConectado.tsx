import type { SaidaLarDetalhe } from '@controle/contrato';
import { useState } from 'react';
import { DialogoConfirmacao } from '../../componentes/base/DialogoConfirmacao';
import { Nota } from '../../componentes/base/Nota';
import { useAviso } from '../../componentes/base/useAviso';
import { ConvitePendente } from '../../componentes/lar/ConvitePendente';
import { FormularioConvite } from '../../componentes/lar/FormularioConvite';
import type { ErroDados } from '../../comum/erros';
import { useConvidarMembro, useRevogarConvite } from '../../ganchos/useLar';
import { ROTULO_ERRO } from '../../rotulos/erros';
import { mensagemErro } from '../../rotulos/mensagensErro';

const MEMBROS_MAXIMOS = 2;

/** Lar cheio e convite pendente têm texto próprio; o resto cai nos textos gerais. */
function textoDoErro(erro: ErroDados): string {
  if (erro.tipo === 'regra' && (erro.codigo === 'lar_cheio' || erro.codigo === 'convite_pendente')) {
    return ROTULO_ERRO[erro.codigo].texto;
  }
  return mensagemErro(erro);
}

/** Convite do titular: enviar, ver o pendente e cancelar. Quem não é titular não recebe esta parte. */
export function ConviteConectado({ lar }: { lar: SaidaLarDetalhe }) {
  const convidar = useConvidarMembro();
  const revogar = useRevogarConvite();
  const { mostrar } = useAviso();
  const [erro, setErro] = useState<ErroDados | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const titular = lar.membros.find((m) => m.sou_eu)?.papel === 'titular';
  if (!titular) {
    return <Nota>Só o titular do lar convida e remove convites.</Nota>;
  }

  const pendente = lar.convite_pendente;
  if (pendente) {
    return (
      <>
        <ConvitePendente
          email={pendente.email}
          expiraEm={pendente.expira_em}
          cancelando={revogar.isPending}
          aoCancelar={() => setCancelando(true)}
        />
        <DialogoConfirmacao
          aberto={cancelando}
          titulo="Cancelar o convite?"
          texto={`O link enviado para ${pendente.email} deixa de funcionar. Você pode convidar de novo depois.`}
          rotuloConfirmar="Cancelar convite"
          rotuloCancelar="Manter convite"
          variante="destrutiva"
          aoConfirmar={() => {
            setCancelando(false);
            revogar.mutate(pendente.id, {
              onSuccess: () => mostrar('sucesso', 'Convite cancelado'),
              onError: (e) => mostrar('erro', textoDoErro(e)),
            });
          }}
          aoCancelar={() => setCancelando(false)}
        />
      </>
    );
  }

  if (lar.membros.length >= MEMBROS_MAXIMOS) {
    return <Nota>A casa já tem os dois membros. Não há convite para enviar.</Nota>;
  }

  const emailRecusado = erro?.tipo === 'regra' && erro.codigo === 'valor_invalido';
  return (
    <FormularioConvite
      salvando={convidar.isPending}
      erroEmail={emailRecusado ? 'Confira o e-mail. Não vale o seu próprio endereço.' : undefined}
      erro={erro && !emailRecusado ? textoDoErro(erro) : undefined}
      aoEditar={() => setErro((atual) => (atual?.tipo === 'regra' ? null : atual))}
      aoEnviar={(email) => {
        setErro(null);
        convidar.mutate(email, {
          onSuccess: (criado) => mostrar('sucesso', `Convite enviado para ${criado.email}`),
          onError: setErro,
        });
      }}
    />
  );
}
