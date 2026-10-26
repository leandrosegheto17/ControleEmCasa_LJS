import { useQuery } from '@tanstack/react-query';
import { arquivarCategoria, excluirCategoria, salvarCategoria } from '../dados/comandos/categorias';
import { buscarCategoria, buscarCategorias } from '../dados/consultas/categorias';
import type { ErroDados } from '../comum/erros';
import { CHAVES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';

type Categorias = Awaited<ReturnType<typeof buscarCategorias>>;
type Categoria = Awaited<ReturnType<typeof buscarCategoria>>;

export const useCategorias = () =>
  useQuery<Categorias, ErroDados>({
    queryKey: CHAVES.categorias,
    queryFn: buscarCategorias,
    refetchOnWindowFocus: true,
  });

export const useCategoria = (id: string) =>
  useQuery<Categoria, ErroDados>({
    queryKey: CHAVES.categoria(id),
    queryFn: () => buscarCategoria(id),
    refetchOnWindowFocus: true,
  });

export function useComandosCategoria() {
  const afetadas = [CHAVES.categorias];
  return {
    salvarCategoria: useComandoCadastro(salvarCategoria, afetadas),
    arquivarCategoria: useComandoCadastro(arquivarCategoria, afetadas),
    excluirCategoria: useComandoCadastro(excluirCategoria, afetadas),
  };
}
