import type { SaidaLancamentosMes as LancamentosMes } from '@controle/contrato';
import { useLocation } from 'react-router';
import { formatarDiaSemana } from '../../formatacao/data';
import { formatarTituloLancamento } from '../../formatacao/lancamento';
import { LinhaLancamento } from '../LinhaLancamento';
import { GrupoDia } from './GrupoDia';

interface Props {
  itens: LancamentosMes['itens'];
  /** Para mostrar "Você" no pagador. */
  membroAtualId: string;
}

type Item = LancamentosMes['itens'][number];

/** Agrupa por dia na ordem recebida: a API já entrega do mais recente para o mais antigo. */
function agruparPorDia(itens: Item[]): { data: string; itens: Item[] }[] {
  const grupos: { data: string; itens: Item[] }[] = [];
  for (const item of itens) {
    const ultimo = grupos.at(-1);
    if (ultimo?.data === item.data) ultimo.itens.push(item);
    else grupos.push({ data: item.data, itens: [item] });
  }
  return grupos;
}

export function ListaLancamentosMes({ itens, membroAtualId }: Props) {
  // O detalhe volta para esta lista, com o mês e os filtros da URL.
  const { pathname, search } = useLocation();
  const estado = { voltarPara: `${pathname}${search}` };
  return (
    <>
      {agruparPorDia(itens).map(({ data, itens: doDia }) => (
        <GrupoDia key={data} id={`dia-${data}`} titulo={formatarDiaSemana(data)}>
          {doDia.map((item) => (
            <div role="listitem" key={item.parcela_id}>
              <LinhaLancamento
                href={`/app/lancamentos/${item.lancamento_id}`}
                escopo={item.escopo}
                titulo={formatarTituloLancamento(
                  item.descricao,
                  item.categoria.nome,
                  item.parcela_numero,
                  item.total_parcelas,
                )}
                parcela={{ numero: item.parcela_numero, total: item.total_parcelas }}
                categoria={item.categoria.nome}
                variavel={item.categoria.variavel === true}
                tipo={item.tipo}
                valorCentavos={item.valor_centavos}
                data={item.data}
                pagador={{ nome: item.pagador.nome, souEu: item.pagador.id === membroAtualId }}
                estado={estado}
              />
            </div>
          ))}
        </GrupoDia>
      ))}
    </>
  );
}
