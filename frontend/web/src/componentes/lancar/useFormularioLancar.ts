import { useState } from 'react';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { hojeEmSaoPaulo } from '../../formatacao/data';
import { contaInicial } from './contaInicial';
import { formaInicial } from './formaInicial';
import type { TipoLancamento } from '../../comum/envio';

export interface EstadoLancar {
  valorCentavos: number;
  categoriaId: string | null;
  formaId: string | null;
  parcelas: number;
  data: string;
  descricao: string;
}

/** Estado da folha: os campos da despesa mais o tipo e a conta de destino da receita. */
export interface EstadoFormulario extends EstadoLancar {
  tipo: TipoLancamento;
  contaId: string | null;
}

export interface ErrosLancar {
  valor?: string;
  categoria?: string;
}

const ERRO_CAMPO: Partial<Record<keyof EstadoFormulario, keyof ErrosLancar>> = {
  valorCentavos: 'valor',
  categoriaId: 'categoria',
};

const novoEstado = (): EstadoFormulario => ({
  tipo: 'despesa',
  contaId: null,
  valorCentavos: 0,
  categoriaId: null,
  formaId: null,
  parcelas: 1,
  data: hojeEmSaoPaulo(),
  descricao: '',
});

/** Estado de tela da folha de lançamento; a forma vem de `dados_lancamento` enquanto não for escolhida. */
export function useFormularioLancar(dados?: DadosLancamento) {
  const [estado, setEstado] = useState<EstadoFormulario>(novoEstado);
  const [erros, setErros] = useState<ErrosLancar>({});

  function mudar<C extends keyof EstadoFormulario>(campo: C, valor: EstadoFormulario[C]) {
    const campoComErro = ERRO_CAMPO[campo];
    if (campoComErro) setErros((atuais) => ({ ...atuais, [campoComErro]: undefined }));
    setEstado((atual) => {
      const proximo = { ...atual, [campo]: valor };
      if (campo === 'formaId') {
        const tipo = dados?.formas.find((f) => f.id === valor)?.tipo;
        if (tipo !== 'credito') proximo.parcelas = 1;
      }
      // As listas de categoria de despesa e de receita são diferentes.
      if (campo === 'tipo') proximo.categoriaId = null;
      return proximo;
    });
  }

  /** Confere os campos obrigatórios; devolve se estão todos preenchidos. */
  function validar(): boolean {
    const novos: ErrosLancar = {};
    if (estado.valorCentavos <= 0) novos.valor = 'Informe um valor maior que zero.';
    if (!estado.categoriaId) novos.categoria = 'Escolha uma categoria.';
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  /** Depois de lançar: tudo volta ao início, menos o tipo, a forma de pagamento e a conta. */
  function limpar() {
    setEstado((atual) => ({ ...novoEstado(), tipo: atual.tipo, formaId: atual.formaId, contaId: atual.contaId }));
    setErros({});
  }

  /** Troca todos os campos (abrir a folha a partir de um item da fila). Categoria ou forma que não existem mais ficam em branco. */
  function preencher(valores: EstadoLancar) {
    setErros({});
    setEstado({
      ...novoEstado(),
      ...valores,
      categoriaId:
        dados && !dados.categorias_despesa.some((c) => c.id === valores.categoriaId) ? null : valores.categoriaId,
      formaId: dados && !dados.formas.some((f) => f.id === valores.formaId) ? null : valores.formaId,
    });
  }

  const formaId = estado.formaId ?? (dados ? formaInicial(dados) : null);
  const contaId = estado.contaId ?? (dados ? contaInicial(dados) : null);
  return { estado: { ...estado, formaId, contaId }, erros, mudar, validar, limpar, preencher };
}
