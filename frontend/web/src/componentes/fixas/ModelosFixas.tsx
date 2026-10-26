import type { SaidaLinhaDespesasFixas as LinhaDespesasFixas } from '@controle/contrato';
import { comMes } from '../../formatacao/mes';
import { formatarMoeda } from '../../formatacao/moeda';
import { BotaoLink } from '../base/BotaoLink';
import { ItemLink } from '../base/ItemLink';
import { GrupoMenu } from '../GrupoMenu';
import estilo from './ModelosFixas.module.css';

interface Props {
  mes: string;
  /** Só os modelos ativos, na ordem da API. */
  modelos: readonly LinhaDespesasFixas[];
}

export function ModelosFixas({ mes, modelos }: Props) {
  return (
    <GrupoMenu
      titulo="Modelos"
      rodape={
        <div className={estilo.nova}>
          <BotaoLink para="/app/fixas/nova" variante="secundario" icone="mais">
            Nova despesa fixa
          </BotaoLink>
        </div>
      }
    >
      {modelos.map((m) => (
        <ItemLink
          key={m.id}
          para={comMes(`/app/fixas/${m.id}`, mes)}
          rotulo={m.descricao}
          subtitulo={`${m.categoria} · dia ${m.dia_vencimento}`}
          valor={formatarMoeda(m.valor_previsto_centavos)}
        />
      ))}
    </GrupoMenu>
  );
}
