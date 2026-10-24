# Comportamento (fase 5)

Responde: **o que o sistema faz para o usuário?** É o método da seção 3 (Comportamento observado) da skill `arqueologia`, aplicado aos fluxos principais do projeto inteiro: **confirmar rodando, não só lendo**.

## Escolher os fluxos

A partir de rotas, telas, comandos e tarefas agendadas do inventário, proponha ao usuário os 3 a 7 fluxos que mais importam para o público (ex.: cadastro e login, criar pedido, pagamento, relatório mensal, importação noturna) e confirme via `AskUserQuestion`. Mais que isso vira manual de referência, que o código mostra melhor.

## Para cada fluxo

1. **Ler o caminho** com o `leitor-codigo` (entrada → validação → regra → dados → saída, com `arquivo:linha`), incluindo regras de negócio, estados e transições, erros tratados e efeitos colaterais (e-mail, fila, arquivo).
2. **Rodar** na aplicação local da fase 3 (worktree novo se o anterior foi removido): a requisição, a tela ou o comando, com dado de teste. Anote o que foi feito e o que voltou. Um teste automatizado que exercita o fluxo e passa também é execução: cite o teste e o comando.
3. **Provocar os erros principais** (entrada inválida, sem permissão, recurso inexistente) e anotar a resposta real.
4. **Registrar o estranho como é**: valores especiais, dependência de ordem, formato que só funciona de um jeito. O documento descreve o que acontece; se parecer defeito, vai também para **Achados fora do escopo** de `documentacao.md` com a oferta da skill `bug`.

Fluxo que não dá para rodar (precisa de terceiro, de produção, de dado que não existe local): documente pela leitura com a marca `Não verificado` e o motivo.

## Modelo de `comportamento.md`

```markdown
# Comportamento: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto> · **Aplicação**: <endereço local, dados de teste usados>

## <Fluxo>
- **Quem e por onde**: <ator, rota ou tela>
- **Caminho**: <entrada `arquivo:linha`> → <regra `arquivo:linha`> → <dados `arquivo:linha`>
- **Regras de negócio**: <regra> — `arquivo:linha`
- **Estados**: <estado → estado, gatilho> — `arquivo:linha`
- **Erros**: <caso> → <resposta real>
- **Confirmado**: <comando ou passos executados> → <resultado observado> (<data>) | Não verificado — <motivo>
- **Estranho**: <comportamento> — <anotado | achado fora do escopo>
```

## Documento

No destino (em geral `docs/fluxos.md`; para cliente, guia de uso): um bloco por fluxo, na linguagem do público. Para dev: caminho no código e regras com o porquê quando houver. Para cliente: passos, o que esperar e mensagens de erro reais. Diagrama de sequência Mermaid só no fluxo em que a ordem entre partes confunde.
