import { useState } from 'react';
import { Botao } from '../../componentes/base/Botao';
import { FormularioCategoria } from '../../componentes/FormularioCategoria';
import { useAcoesCategoria } from './useAcoesCategoria';

export function NovaCategoria() {
  // O mesmo id em todos os envios: reenviar depois de uma falha de rede não cria duas categorias.
  const [id] = useState(() => crypto.randomUUID());
  const acoes = useAcoesCategoria(id, 'despesa');
  return (
    <FormularioCategoria
      inicial={{ nome: '', tipo: 'despesa', escopo: 'conjunto', variavel: true }}
      tipoEscopoFixos={false}
      erroNome={acoes.erroNome}
      aoSalvar={acoes.salvar}
    >
      <Botao variante="principal" tipo="submit" salvando={acoes.salvando}>
        Criar categoria
      </Botao>
    </FormularioCategoria>
  );
}
