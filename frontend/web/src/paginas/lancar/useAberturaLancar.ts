import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Estado de abertura da folha: a rota `/lancar` a abre; fechá-la ali volta para `/`. */
export function useAberturaLancar() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const emLancar = pathname === '/app/lancar';
  const [aberta, setAberta] = useState(emLancar);

  useEffect(() => {
    if (emLancar) setAberta(true);
  }, [emLancar]);

  return {
    aberta,
    abrir: () => setAberta(true),
    fechar() {
      setAberta(false);
      if (emLancar) navegar('/app', { replace: true });
    },
  };
}
