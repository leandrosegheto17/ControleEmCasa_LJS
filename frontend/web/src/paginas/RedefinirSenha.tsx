import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormularioNovaSenha } from '../componentes/FormularioNovaSenha';
import { useAviso } from '../componentes/base/useAviso';
import type { ErroDados } from '../comum/erros';
import { useRedefinirSenha } from '../ganchos/useRedefinirSenha';
import { ROTULO_ERRO } from '../rotulos/erros';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../rotulos/textosConexao';

const LINK_EXPIRADO = 'Este link expirou. Peça outro em Entrar, em Esqueci minha senha.';

/** O link do e-mail traz o token no fragmento (`#t=…`), que não vai para o servidor nem para logs (G-18). */
function lerTokenDoFragmento(): string | undefined {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('t');
  return token ? token : undefined;
}

function textoErroTopo(erro: ErroDados | null, semToken: boolean): string | undefined {
  if (semToken || (erro?.tipo === 'regra' && erro.codigo === 'link_expirado')) return LINK_EXPIRADO;
  if (!erro || (erro.tipo === 'regra' && erro.codigo === 'senha_fraca')) return undefined;
  if (erro.tipo === 'rede') return TEXTO_SEM_CONEXAO;
  if (erro.tipo === 'indisponivel') return TEXTO_SERVIDOR_INDISPONIVEL;
  if (erro.tipo === 'regra' && (erro.codigo === 'muitas_requisicoes' || erro.codigo === 'muitas_tentativas')) {
    return ROTULO_ERRO[erro.codigo].texto;
  }
  return 'Não foi possível salvar a senha. Tente de novo.';
}

/** Página do link de redefinição: lê o token do fragmento, tira-o do endereço e pede a nova senha. */
export function RedefinirSenha() {
  // Lido na primeira renderização e só apagado do endereço no efeito (o StrictMode renderiza duas vezes).
  const [token] = useState(lerTokenDoFragmento);
  const salvar = useRedefinirSenha();
  const { mostrar } = useAviso();
  const navegar = useNavigate();

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);

  function aoSalvar(senha: string) {
    if (!token) return;
    salvar.mutate(
      { token, senha },
      {
        onSuccess: () => {
          mostrar('sucesso', 'Senha alterada. Entre com a nova senha.');
          navegar('/entrar', { replace: true });
        },
      },
    );
  }

  const senhaFraca = salvar.error?.tipo === 'regra' && salvar.error.codigo === 'senha_fraca';

  return (
    <FormularioNovaSenha
      aoSalvar={aoSalvar}
      ocupado={salvar.isPending}
      erroTopo={textoErroTopo(salvar.error, token === undefined)}
      erroSenhaServidor={senhaFraca ? 'Use pelo menos 12 caracteres.' : undefined}
    />
  );
}
