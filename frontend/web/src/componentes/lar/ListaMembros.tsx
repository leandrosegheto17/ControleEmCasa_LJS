import type { SaidaLarDetalhe } from '@controle/contrato';
import { useId } from 'react';
import { AVISO_PRECISA_CONEXAO } from '../../rotulos/lar';
import { GrupoMenu } from '../GrupoMenu';
import { Botao } from '../base/Botao';
import lista from '../base/Lista.module.css';
import { Nota } from '../base/Nota';

type Membro = SaidaLarDetalhe['membros'][number];

const PAPEL = { titular: 'Titular', membro: 'Membro' } as const;

interface Props {
  membros: readonly Membro[];
  /** Vem de `useConectado` na página (componentes/ não importa ganchos/, SDD 9.1). */
  conectado: boolean;
  /** Titular tocou em "Remover" no outro membro. Sem ele, o botão não aparece. */
  aoRemover?: (id: string) => void;
  /** Membro não titular tocou em "Sair da casa". Sem ele, o botão não aparece. */
  aoSair?: () => void;
}

/**
 * Os membros ativos do lar (no máximo dois). O e-mail do outro membro não vem da API (PRD-TECNICO §2).
 * O titular vê "Remover" no outro membro; o membro vê "Sair da casa" em si mesmo. As duas ações são só online:
 * sem conexão os botões ficam desativados, com o aviso. Aqui só se avisa o pai; a confirmação e a chamada são dele.
 */
export function ListaMembros({ membros, conectado, aoRemover, aoSair }: Props) {
  const idAviso = useId();
  const souTitular = membros.find((m) => m.sou_eu)?.papel === 'titular';

  const acao = (m: Membro) => {
    if (aoRemover && souTitular && !m.sou_eu) return { rotulo: 'Remover', aoTocar: () => aoRemover(m.id) };
    if (aoSair && !souTitular && m.sou_eu && m.papel === 'membro') return { rotulo: 'Sair da casa', aoTocar: aoSair };
    return null;
  };
  const temAcao = membros.some((m) => acao(m) !== null);

  return (
    <GrupoMenu
      titulo="Membros"
      rodape={
        temAcao && !conectado ? (
          <div id={idAviso}>
            <Nota icone>{AVISO_PRECISA_CONEXAO}</Nota>
          </div>
        ) : null
      }
    >
      {membros.map((m) => {
        const botao = acao(m);
        return (
          <li key={m.id}>
            <span className={lista.info}>
              <span className={lista.titulo}>{m.nome}</span>
              <span className={lista.sub}>
                {PAPEL[m.papel]}
                {m.sou_eu ? ' · você' : ''}
              </span>
            </span>
            {botao ? (
              <Botao
                variante="perigo"
                disabled={!conectado}
                aria-describedby={conectado ? undefined : idAviso}
                onClick={botao.aoTocar}
              >
                {botao.rotulo}
              </Botao>
            ) : null}
          </li>
        );
      })}
    </GrupoMenu>
  );
}
