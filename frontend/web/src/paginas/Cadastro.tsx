import { useState } from 'react';
import { CartaoAcesso } from '../componentes/CartaoAcesso';
import { FormularioCadastro } from '../componentes/FormularioCadastro';
import { FormularioReenviar } from '../componentes/FormularioReenviar';
import { LinkMais } from '../componentes/base/LinkMais';
import { Nota } from '../componentes/base/Nota';
import { useCadastrar } from '../ganchos/useCadastrar';
import { useReenviar } from '../ganchos/useReenviar';

/** Texto do estado "enviado": o mesmo para e-mail novo ou já cadastrado, para não revelar contas (CA-19.3, G-19). */
export const TEXTO_CADASTRO_ENVIADO =
  'Enviamos um link de confirmação para o e-mail informado. Abra o link para ativar a conta; ele vale por 30 minutos.';

export function Cadastro() {
  const cadastrar = useCadastrar();
  const reenviar = useReenviar();
  const [email, setEmail] = useState('');

  if (cadastrar.isSuccess) {
    return (
      <CartaoAcesso titulo="Confira seu e-mail" aoEnviar={() => undefined}>
        <Nota icone>{TEXTO_CADASTRO_ENVIADO}</Nota>
        <FormularioReenviar
          emailInicial={email}
          aoReenviar={(e) => reenviar.mutate(e)}
          ocupado={reenviar.isPending}
          enviado={reenviar.isSuccess}
          erro={reenviar.error}
        />
        <LinkMais centralizado para="/entrar">
          Ir para Entrar
        </LinkMais>
      </CartaoAcesso>
    );
  }

  return (
    <FormularioCadastro
      aoEnviar={(dados) => {
        setEmail(dados.email);
        cadastrar.mutate(dados);
      }}
      ocupado={cadastrar.isPending}
      erro={cadastrar.error}
    />
  );
}
