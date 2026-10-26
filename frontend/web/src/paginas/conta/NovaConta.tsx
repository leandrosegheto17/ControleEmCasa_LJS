import { useState } from 'react';
import { Botao } from '../../componentes/base/Botao';
import { FormularioConta } from '../../componentes/FormularioConta';
import { useAcoesConta } from './useAcoesConta';

export function NovaConta() {
  // O mesmo id em todos os envios: reenviar depois de uma falha de rede não cria duas contas.
  const [id] = useState(() => crypto.randomUUID());
  const acoes = useAcoesConta(id);
  return (
    <FormularioConta
      nomeInicial=""
      saldoInicialCentavos={0}
      erroSaldoInicial={acoes.erroSaldoInicial}
      aoSalvar={acoes.salvar}
    >
      <Botao variante="principal" tipo="submit" salvando={acoes.salvando}>
        Salvar
      </Botao>
    </FormularioConta>
  );
}
