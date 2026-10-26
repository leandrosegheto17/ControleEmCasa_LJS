import { Botao } from '../../componentes/base/Botao';
import { useSair } from '../../ganchos/useSair';
import { useSessao } from '../../ganchos/useSessao';

/**
 * Início provisório do app. SPEC_DEVIATION: a tela real (resumo do mês e folha Lançar) é da etapa 12; aqui há só o
 * necessário para provar a guarda de rota e a saída (G-39).
 */
export function Inicio() {
  const estado = useSessao();
  const sair = useSair();
  const nome = estado.situacao === 'ativa' ? estado.sessao.usuario.nome : null;
  return (
    <main>
      <h1>Controle em Casa</h1>
      {nome ? <p>Olá, {nome}.</p> : null}
      <Botao variante="secundario" onClick={() => sair.mutate('local')}>
        Sair
      </Botao>
    </main>
  );
}
