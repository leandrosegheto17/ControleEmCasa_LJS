# Sistema de design (fase 5)

Responde: **como cada tela nova vai sair igual às outras?** O guia (`mockup/tokens.css` e `mockup/guia.html`) é feito pela skill `mockup-visual`, etapa 2a, modo redesign. Este arquivo cobre o que o guia sozinho não diz: de onde cada peça vem, como se usa, e o que some.

## 1. Mapa de componentes

Percorra o inventário (`inventario-telas.md` e a categoria Interface de `.specs/projeto/inventario.md`) e classifique **cada** componente e variação em uso hoje:

- **reaproveitado**: o componente atual continua, só com a aparência nova (troca de estilo, mesma marcação e comportamento);
- **substituído por** `<componente do guia>`: a função continua, a peça muda;
- **unificado em** `<componente do guia>`: várias variações viram uma (diga quais e o parâmetro que as distingue);
- **novo**: nenhum atual serve; diga o nome, o propósito e onde mais será usado;
- **eliminado**: some, com o motivo (e confirme que nenhuma função se perde: se perde, é regra e não entra).

Nenhum componente fica sem classificação. Antes de aceitar um **novo**, proponha o reuso de um existente com um parâmetro; variação só se o caso de uso for de fato diferente.

## 2. Regras de uso

Curtas, no `guia.html` e resumidas aqui: quando usar cada variação (primário: uma ação principal por tela; secundário; perigoso com confirmação), hierarquia de títulos, densidade de listas e tabelas, mensagens (tom, erro diz como resolver), ícones (sempre com texto ou nome acessível), o que não fazer.

## 3. Tokens

- Todo valor visual do guia é token; nomes pelo papel (`--cor-erro`), não pelo valor (`--vermelho`).
- **Como os tokens chegam ao código** fica para a fase 7 (copiar `tokens.css`, ou mapear para o tema da biblioteca do projeto apontando para `var(--...)`); anote aqui só restrições (ex.: a biblioteca obrigatória tem tema próprio).
- Valor novo pedido depois da aprovação: vira token no `tokens.css` do mockup, com aprovação, e só então entra no código.

## 4. Acessibilidade

Requisitos de [acessibilidade.md](acessibilidade.md), seção "Requisitos", aplicados ao guia: contraste de cada par, foco visível, alvos de toque, estados de erro com texto e não só cor. O guia não é aprovado com violação crítica.

## Modelo de `sistema.md`

```markdown
# Sistema de design: <slug>

- **Guia**: `mockup/guia.html` · **Tokens**: `mockup/tokens.css` · **Aprovado em**: <AAAA-MM-DD>

## Mapa de componentes

| Componente atual | Onde | Decisão | Componente do guia | Observação |
|---|---|---|---|---|
| BotaoAzul, BotaoSalvar, `.btn-ok` | 14 telas | unificado em | `botao-primario` | variação por tamanho, não por cor |

## Componentes novos

| Nome | Propósito | Onde mais pode ser usado |
|---|---|---|

## Regras de uso

- <regra>

## Restrições para o código

- <biblioteca, tema, fonte hospedada, etc.>
```
