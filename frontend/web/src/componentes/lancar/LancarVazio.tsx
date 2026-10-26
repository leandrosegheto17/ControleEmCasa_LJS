import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { BotaoLink } from '../base/BotaoLink';
import { EstadoVazio } from '../base/EstadoVazio';
import type { TipoLancamento } from '../../comum/envio';

interface Props {
  dados: DadosLancamento;
  /** Fecha a folha quando o link leva a outra tela. */
  aoFechar: () => void;
  tipo?: TipoLancamento;
}

/** Sem forma de pagamento ou categoria ativa (despesa) ou sem conta (receita) não há o que lançar: o caminho é cadastrar. */
export function LancarVazio({ dados, aoFechar, tipo = 'despesa' }: Props) {
  if (tipo === 'receita') {
    return (
      <EstadoVazio
        nivel={3}
        semMargem
        icone="cartao"
        titulo="Cadastre uma conta para lançar receita"
        texto="A receita entra no saldo de uma conta. Só você vê as suas contas."
        acao={
          <BotaoLink para="/app/ajustes/contas/nova" variante="principal" aoClicar={aoFechar}>
            Cadastrar conta
          </BotaoLink>
        }
      />
    );
  }
  if (dados.formas.length === 0) {
    return (
      <EstadoVazio
        nivel={3}
        semMargem
        icone="cartao"
        titulo="Cadastre uma forma de pagamento para lançar"
        texto="Pix, Débito ou um cartão de crédito. Só você vê as suas formas de pagamento."
        acao={
          <BotaoLink para="/app/ajustes/formas/nova" variante="principal" aoClicar={aoFechar}>
            Cadastrar forma
          </BotaoLink>
        }
      />
    );
  }
  return (
    <EstadoVazio
      nivel={3}
      semMargem
      icone="lista"
      titulo="Nenhuma categoria ativa"
      texto="Crie ou reative uma categoria para lançar suas despesas."
      acao={
        <BotaoLink para="/app/ajustes/categorias" variante="principal" aoClicar={aoFechar}>
          Gerenciar categorias
        </BotaoLink>
      }
    />
  );
}
