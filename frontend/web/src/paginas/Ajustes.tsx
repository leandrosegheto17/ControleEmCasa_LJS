import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { DialogoConfirmacao } from '../componentes/base/DialogoConfirmacao';
import { ItemLink } from '../componentes/base/ItemLink';
import { ItemValor } from '../componentes/base/ItemValor';
import { useAviso } from '../componentes/base/useAviso';
import { GrupoMenu } from '../componentes/GrupoMenu';
import { useContexto } from '../ganchos/useContexto';
import { useSair } from '../ganchos/useSair';
import { mensagemErro } from '../rotulos/mensagensErro';

interface Props {
  instalado: boolean;
  aoInstalar: () => void;
}

const TEXTO_SAIR_TODOS =
  'Você vai precisar entrar de novo com e-mail e senha em todos os aparelhos, inclusive neste. Lançamentos aguardando envio continuam guardados no aparelho.';

export function Ajustes({ instalado, aoInstalar }: Props) {
  const navegar = useNavigate();
  const { mostrar } = useAviso();
  const contexto = useContexto();
  const sair = useSair();
  const [confirmando, setConfirmando] = useState(false);
  const membro = contexto.data?.membro;

  function sairDeste() {
    sair.mutate('local', { onSettled: () => navegar('/entrar', { replace: true }) });
  }

  function sairDeTodos() {
    setConfirmando(false);
    sair.mutate('global', {
      onSuccess: () => navegar('/entrar', { replace: true }),
      onError: (erro) => mostrar('erro', mensagemErro(erro)),
    });
  }

  return (
    <>
      <CabecalhoPagina titulo="Ajustes" voltarPara="/app" rotuloVoltar="Voltar para Início" />
      <main>
        {membro ? (
          <p className="texto-2 pequeno">
            {membro.nome} · {membro.email}
          </p>
        ) : null}
        <GrupoMenu titulo="Cadastros">
          <ItemLink icone="banco" rotulo="Contas" para="/app/ajustes/contas" />
          <ItemLink icone="cartao" rotulo="Formas de pagamento" para="/app/ajustes/formas" />
          <ItemLink icone="lista" rotulo="Categorias" para="/app/ajustes/categorias" />
          <ItemLink icone="relogio" rotulo="Despesas fixas" para="/app/fixas" />
        </GrupoMenu>
        <GrupoMenu titulo="Aplicativo">
          {instalado ? null : <ItemLink icone="adicionar" rotulo="Instalar o app" seta aoClicar={aoInstalar} />}
          <ItemValor rotulo="Versão" valor={__VERSAO_APP__} />
        </GrupoMenu>
        <GrupoMenu titulo="Sessão">
          <ItemLink icone="sair" rotulo="Sair deste aparelho" aoClicar={sairDeste} />
          <ItemLink icone="sair" rotulo="Sair de todos os aparelhos" destrutivo aoClicar={() => setConfirmando(true)} />
        </GrupoMenu>
      </main>
      <DialogoConfirmacao
        aberto={confirmando}
        titulo="Sair de todos os aparelhos?"
        texto={TEXTO_SAIR_TODOS}
        rotuloConfirmar="Sair de todos"
        iconeConfirmar="sair"
        variante="destrutiva"
        aoConfirmar={sairDeTodos}
        aoCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
