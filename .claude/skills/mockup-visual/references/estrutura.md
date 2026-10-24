# Estrutura e checklist do mockup

## Pastas

```
.specs/mockup/
  direcoes/
    index.html            galeria das direções, lado a lado
    a-<nome>/index.html   uma direção: a tela-chave, responsiva
    b-<nome>/index.html
  tokens.css              única fonte de cores, fontes, espaços, raios, sombras, quebras
  guia.html               componentes base + vazio / carregando / erro + tabela de contraste
  telas/<tela>.html       2 ou 3 telas-chave, responsivas
  index.html              galeria: guia + telas em PC e celular (+ "Mockup × app" na fase 10)
  comparacao/<data>/      prints do app (fase 10)
```

## Direções

- Cada direção é um único `index.html` com estilos próprios (ainda sem `tokens.css`).
- Mesma tela, mesmos dados de exemplo nas duas ou três, para comparar só a aparência.
- Na galeria, cada direção aparece em dois `iframe`: 1440 px e 390 px de largura.
- Uma linha por direção dizendo a intenção ("sóbria e densa", "acolhedora e espaçada").

## `tokens.css`

```css
:root {
  /* cores */
  --cor-fundo: ...;  --cor-superficie: ...;  --cor-texto: ...;  --cor-texto-suave: ...;
  --cor-primaria: ...;  --cor-primaria-texto: ...;  --cor-borda: ...;
  --cor-sucesso: ...;  --cor-alerta: ...;  --cor-erro: ...;
  /* tipografia */
  --fonte-base: ...;  --fonte-titulo: ...;
  --texto-p: ...;  --texto-m: ...;  --texto-g: ...;  --texto-gg: ...;
  --peso-normal: 400;  --peso-forte: 600;
  /* espaçamento (escala) */
  --esp-1: 4px;  --esp-2: 8px;  --esp-3: 12px;  --esp-4: 16px;  --esp-6: 24px;  --esp-8: 32px;
  /* forma */
  --raio-p: ...;  --raio-m: ...;  --sombra-1: ...;
  /* quebras (referência; media queries usam o valor) */
  --quebra-celular: 640px;
}
```

Nomes podem mudar conforme o produto, mas a regra não: **todo valor visual vem daqui**.

## `guia.html`

- Usa só `tokens.css`.
- Componentes: botão (primário, secundário, desabilitado, com foco), campo (normal, com ajuda, com erro), seleção, cartão, lista ou tabela, aviso (sucesso, alerta, erro), navegação principal.
- Padrões de estado, uma vez cada: **vazio** (mensagem + ação), **carregando** (esqueleto ou indicador), **erro** (mensagem + como resolver).
- Tabela de contraste: cada par texto/fundo usado, com a razão calculada.

## Telas-chave

- Usam só `tokens.css` e as classes do guia.
- Responsivas: o mesmo HTML vale para PC e celular, como no app.
- Dados de exemplo realistas (nomes, datas e valores plausíveis), em volume suficiente para mostrar rolagem quando a tela tiver lista.
- Estrutura semântica: `<header>`, `<nav>`, `<main>`, `<h1>`, `<table>`, `<form>`, `<label>`.

## Checklist antes de publicar

- [ ] Nenhuma cor, fonte ou espaçamento solto: tudo via `var(--...)`.
- [ ] Contraste: texto normal ≥ 4,5:1; texto grande e contorno de controle ≥ 3:1. Se o usuário quiser algo abaixo, a decisão é registrada na aprovação.
- [ ] Foco visível desenhado em botões, campos e links.
- [ ] Alvos de toque ≥ 44 px no celular.
- [ ] Vazio, carregando e erro presentes no guia.
- [ ] As telas-chave usam os componentes do guia, sem variações inventadas.
- [ ] Sem script de terceiros nas telas.
