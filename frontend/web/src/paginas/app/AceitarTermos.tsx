import { Link } from 'react-router';
import { CartaoAcesso } from '../../componentes/CartaoAcesso';
import { AvisoErroTopo } from '../../componentes/base/AvisoErroTopo';
import { Botao } from '../../componentes/base/Botao';
import { Nota } from '../../componentes/base/Nota';
import { useAceitarTermos } from '../../ganchos/useLar';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../../rotulos/textosConexao';

/** Novo aceite quando a versão dos termos muda (CA-19.7). Em sucesso a sessão é relida e a guarda segue. */
export function AceitarTermos() {
  const aceitar = useAceitarTermos();
  const erro = aceitar.error;
  return (
    <CartaoAcesso titulo="Termos atualizados" aoEnviar={() => aceitar.mutate()} ocupado={aceitar.isPending}>
      {erro ? (
        <AvisoErroTopo>
          {erro.tipo === 'rede'
            ? TEXTO_SEM_CONEXAO
            : erro.tipo === 'indisponivel'
              ? TEXTO_SERVIDOR_INDISPONIVEL
              : 'Não foi possível registrar o aceite. Tente de novo.'}
        </AvisoErroTopo>
      ) : null}
      <Nota>
        Atualizamos os <Link to="/termos">Termos de uso</Link> e a{' '}
        <Link to="/privacidade">Política de privacidade</Link>. Para continuar, leia e aceite as novas versões.
      </Nota>
      <Botao variante="principal" bloco tipo="submit" salvando={aceitar.isPending} rotuloOcupado="Registrando…">
        Li e aceito
      </Botao>
    </CartaoAcesso>
  );
}
