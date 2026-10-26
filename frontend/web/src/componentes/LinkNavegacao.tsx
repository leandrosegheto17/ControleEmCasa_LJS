import { Link, matchPath, useLocation } from 'react-router';
import { Icone } from './base/Icone';
import { destinoDoItem, type ItemNavegacao } from './itensNavegacao';

interface Props {
  item: ItemNavegacao;
  mes?: string;
}

/** Link de um item de navegação; ativo na própria rota (exata ou com sub-rotas) e nas `rotasAninhadas`. */
export function LinkNavegacao({ item, mes }: Props) {
  const { pathname } = useLocation();
  const ativo =
    matchPath({ path: item.rota, end: item.exato ?? false }, pathname) !== null ||
    (item.rotasAninhadas ?? []).some((rota) => matchPath({ path: rota, end: false }, pathname) !== null);
  return (
    <Link to={destinoDoItem(item, mes)} aria-current={ativo ? 'page' : undefined}>
      <Icone nome={item.icone} />
      {item.rotulo}
    </Link>
  );
}
