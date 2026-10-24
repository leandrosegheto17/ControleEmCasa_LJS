# Modo módulo (feature, legado)

Chamado pelas skills `feature` e `legado` quando a feature **cria ou muda telas** (campo **Telas** do `reconhecimento.md`). Objetivo: ver e aprovar as telas do módulo antes do plano, sem refazer a identidade visual do produto.

## Pasta

`.specs/features/<feature>/mockup/`, com a estrutura de [estrutura.md](estrutura.md): `index.html` (galeria), `telas/<tela>.html` e, se preciso, `tokens.css` e `guia.html`.

## Etapa única, com uma aprovação

1. **Partida visual:**
   - **O projeto tem guia** (`.specs/mockup/tokens.css`): sem direções. As telas importam o `tokens.css` do projeto e usam os componentes de `.specs/mockup/guia.html`. Valor novo de cor, fonte ou espaçamento vira token proposto em `mockup/tokens-novos.css`, mostrado na galeria e aprovado junto.
   - **O projeto não tem guia:** tire prints de 1 ou 2 telas atuais parecidas (as do **Modelo a seguir** do `reconhecimento.md`) e monte um `tokens.css` e um `guia.html` mínimos que **reproduzem a aparência atual** (não é redesign: nada de nova identidade). Se o app não tem tela nenhuma ainda (primeiro módulo com interface), faça a etapa 1 normal (2 ou 3 direções) antes desta.
2. **Telas do módulo:** todas as telas que a feature cria ou muda, cada uma com os estados **vazio, carregando, erro e sucesso**, em PC e celular, com dados de exemplo realistas e navegáveis entre si. Tela que muda: mostre o print atual ao lado.
3. **Galeria:** publique `mockup/index.html` (ver "Publicação" no `SKILL.md`) e peça a aprovação. Ajustes republicam no mesmo link.

Aprovado, o orquestrador marca **Mockup** `aprovado` no `reconhecimento.md`, e o mockup vira a fonte de verdade da aparência do módulo: o plano (Design) referencia as telas, e mudança visual depois disso começa no mockup.

## Comparação (verificação da feature)

Etapa 3 do `SKILL.md`, só nas telas do módulo, com prints em `mockup/comparacao/<data>/`. `checar-tokens.py` sobre as pastas do código novo (aceita várias).

## Promoção (integração da feature)

Ao integrar a branch:

- Projeto com `.specs/mockup/`: copie `telas/` do módulo para `.specs/mockup/telas/`, junte `tokens-novos.css` ao `tokens.css` do projeto e acrescente as telas à galeria do projeto.
- Projeto sem `.specs/mockup/`: o mockup do módulo (com o guia mínimo) vira o `.specs/mockup/` do projeto.

Assim a próxima feature com tela já parte de um guia.
