# Convenções (fase 6)

Responde: **como o código é escrito aqui?** São as mesmas perguntas de padrões da skill `reconhecimento` (seção 2, item 3), feitas para o projeto inteiro e com as inconsistências no centro: é nelas que quem chega erra.

## Pedido ao `leitor-codigo`

Um ou mais em paralelo (por área, se o projeto for grande), somente leitura, cada padrão com 2 exemplos `arquivo:linha` e a contagem aproximada de quem segue e quem não segue:

1. **Nomes:** arquivos, pastas, classes, funções, variáveis, tabelas, rotas; idioma dos identificadores.
2. **Organização:** onde fica cada tipo de coisa (rotas, regras, acesso a dados, componentes de tela, testes), camadas e quem pode chamar quem.
3. **Padrões repetidos:** como se valida entrada, como se acessa o banco, como se trata erro e se registra log, como se configura, como se injeta dependência, como se escreve um componente de tela.
4. **Testes:** framework, onde ficam, nome dos arquivos, estilo (unidade, integração, ponta a ponta), dados de teste (fábricas, fixtures), dublês.
5. **Ferramentas que já garantem estilo:** linter, formatador, verificador de tipos, hooks de commit, checagens do CI, com o arquivo de configuração.
6. **Inconsistências:** dois jeitos de fazer a mesma coisa (use também as **Duplicações encontradas** do inventário); qual é o mais recente (`git log` do arquivo) e qual o mais seguido.

## Inconsistência: qual seguir

Para cada uma, a recomendação no documento é **a do código mais recente e mais seguido**, com o motivo. Se os dois critérios discordam ou o caso é ambíguo, pergunte ao usuário via `AskUserQuestion` (sugestão primeiro, "Ainda não sei" registra `[A ESCLARECER]`). Unificar o código é outro trabalho: anote como dívida na fase 7.

## Modelo de `convencoes.md`

```markdown
# Convenções: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto>

## Garantido por ferramenta
- <regra> — `<arquivo de configuração>` (não repetir em prosa)

## Padrões
| Assunto | Padrão | Exemplos | Seguem / não seguem |
|---|---|---|---|

## Inconsistências
| Assunto | Jeito A | Jeito B | Seguir | Por quê |
|---|---|---|---|---|
```

## Documento

No destino (em geral `docs/convencoes.md` ou `CONTRIBUTING.md`): só o que **difere do padrão do ecossistema** ou não é óbvio, cada regra com um exemplo do próprio projeto, as inconsistências com o jeito a seguir, e o ponteiro para a configuração do linter e do formatador. Regra genérica ("use nomes claros") não entra.
