import type { SaidaLinhaCategorias as LinhaCategorias } from '@controle/contrato';
import type { SaidaLinhaDespesasFixas as LinhaDespesasFixas } from '@controle/contrato';
import { useState } from 'react';
import { Botao } from '../../componentes/base/Botao';
import { DialogoConfirmacao } from '../../componentes/base/DialogoConfirmacao';
import { FormularioFixa } from '../../componentes/fixas/FormularioFixa';
import { opcoesCategoriaFixa } from '../../componentes/fixas/opcoesCategoriaFixa';
import { useAcoesFixa } from './useAcoesFixa';

interface Props {
  /** Id da despesa fixa: o do modelo aberto, ou um novo mantido em todas as tentativas de envio. */
  id: string;
  mes: string;
  categorias: readonly LinhaCategorias[];
  modelo?: LinhaDespesasFixas;
}

export function EditorFixa({ id, mes, categorias, modelo }: Props) {
  const acoes = useAcoesFixa(id, mes);
  const [confirmando, setConfirmando] = useState(false);
  const podeEncerrar = modelo !== undefined && modelo.encerrada_em === null;

  return (
    <>
      <FormularioFixa
        categorias={opcoesCategoriaFixa(categorias, modelo && { id: modelo.categoria_id, nome: modelo.categoria })}
        inicial={
          modelo && {
            descricao: modelo.descricao,
            categoriaId: modelo.categoria_id,
            valorCentavos: modelo.valor_previsto_centavos,
            dia: modelo.dia_vencimento,
          }
        }
        erroValor={acoes.erroValor}
        aoSalvar={acoes.salvar}
        acoes={
          <>
            <Botao variante="principal" tipo="submit" salvando={acoes.salvando}>
              Salvar
            </Botao>
            {podeEncerrar ? (
              <Botao variante="perigo" onClick={() => setConfirmando(true)}>
                Encerrar despesa fixa
              </Botao>
            ) : null}
          </>
        }
        nota={
          podeEncerrar
            ? 'Encerrar para de gerar ocorrências a partir do mês seguinte. O histórico continua.'
            : undefined
        }
      />
      <DialogoConfirmacao
        aberto={confirmando}
        titulo={`Encerrar ${modelo?.descricao ?? 'a despesa fixa'}?`}
        texto="Para de gerar ocorrências a partir do mês seguinte. As pagas continuam no histórico."
        rotuloConfirmar="Encerrar despesa fixa"
        variante="destrutiva"
        aoConfirmar={() => {
          setConfirmando(false);
          acoes.encerrar();
        }}
        aoCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
