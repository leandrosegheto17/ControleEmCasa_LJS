import { useEffect } from 'react';

type Atributo = 'name' | 'property';

/** Cria (ou reaproveita) um elemento de `<head>`, aplica o valor e devolve como desfazer. */
function ajustar(seletor: string, criar: () => HTMLElement, atributo: 'content' | 'href', valor: string): () => void {
  let elemento = document.head.querySelector<HTMLElement>(seletor);
  const criado = elemento === null;
  if (!elemento) {
    elemento = criar();
    document.head.appendChild(elemento);
  }
  const anterior = elemento.getAttribute(atributo);
  elemento.setAttribute(atributo, valor);
  const el = elemento;
  return () => {
    if (criado) el.remove();
    else if (anterior !== null) el.setAttribute(atributo, anterior);
  };
}

function meta(atributo: Atributo, nome: string): () => HTMLElement {
  return () => {
    const el = document.createElement('meta');
    el.setAttribute(atributo, nome);
    return el;
  };
}

/**
 * Descrição da página e endereço canônico (SEO básico das páginas públicas). O canônico usa a origem de onde a página
 * foi aberta, porque o domínio só é conhecido na publicação (etapa 17). Ao sair da página, volta ao que havia.
 */
export function useMetaDaPagina(descricao: string, caminhoCanonico: string): void {
  useEffect(() => {
    const desfazer = [
      ajustar('meta[name="description"]', meta('name', 'description'), 'content', descricao),
      ajustar('meta[property="og:description"]', meta('property', 'og:description'), 'content', descricao),
      ajustar(
        'link[rel="canonical"]',
        () => {
          const el = document.createElement('link');
          el.setAttribute('rel', 'canonical');
          return el;
        },
        'href',
        `${window.location.origin}${caminhoCanonico}`,
      ),
    ];
    return () => desfazer.forEach((d) => d());
  }, [descricao, caminhoCanonico]);
}
