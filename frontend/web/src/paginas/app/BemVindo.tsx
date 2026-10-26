import { useState } from 'react';
import { CartaoAcesso } from '../../componentes/CartaoAcesso';
import { AvisoErroTopo } from '../../componentes/base/AvisoErroTopo';
import { Botao } from '../../componentes/base/Botao';
import { CampoTexto } from '../../componentes/base/CampoTexto';
import { Nota } from '../../componentes/base/Nota';
import { useCriarLar } from '../../ganchos/useLar';
import { ROTULO_ERRO } from '../../rotulos/erros';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../../rotulos/textosConexao';

/**
 * Primeiro acesso, sessão sem lar (SDD 9.3): criar o lar. Quem recebeu um convite abre o link do e-mail (`/convite`),
 * que é a forma de entrar no lar de outra pessoa; não há lista de convites a escolher aqui.
 */
export function BemVindo() {
  const criar = useCriarLar();
  const [nome, setNome] = useState('');
  const erro = criar.error;
  const texto = !erro
    ? undefined
    : erro.tipo === 'rede'
      ? TEXTO_SEM_CONEXAO
      : erro.tipo === 'indisponivel'
        ? TEXTO_SERVIDOR_INDISPONIVEL
        : erro.tipo === 'regra'
          ? ROTULO_ERRO[erro.codigo].texto
          : 'Não foi possível criar o lar. Tente de novo.';
  return (
    <CartaoAcesso titulo="Bem-vindo" aoEnviar={() => criar.mutate(nome.trim() || undefined)} ocupado={criar.isPending}>
      {texto ? <AvisoErroTopo>{texto}</AvisoErroTopo> : null}
      <Nota>Crie o lar onde vocês vão registrar as despesas da casa. Você pode convidar mais uma pessoa depois.</Nota>
      <CampoTexto
        rotulo="Nome do lar (opcional)"
        maxLength={60}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Botao variante="principal" bloco tipo="submit" salvando={criar.isPending} rotuloOcupado="Criando…">
        Criar meu lar
      </Botao>
      <Nota icone>Recebeu um convite? Abra o link que chegou no seu e-mail.</Nota>
    </CartaoAcesso>
  );
}
