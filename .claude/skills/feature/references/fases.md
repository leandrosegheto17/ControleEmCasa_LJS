# As 7 fases da feature em projeto existente

Princípio: **entender o que já existe e não quebrar nada.** Projetos feitos com IA costumam ter padrões inconsistentes, pouca documentação e testes irregulares; por isso o reconhecimento e a rede de proteção vêm antes do código.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Pedido | O que a feature faz, para quem, e como saberei que está pronta? | `spec.md` | Critérios de aceite testáveis, fora de escopo explícito, `validate_spec.py` sem erro | Opus |
| 2 | Reconhecimento | Onde isso entra no código existente? | `reconhecimento.md` | Arquivos afetados, modelo a seguir, convenções, testes e riscos mapeados; arquitetura cabe (ou decisão registrada) | Sonnet (leitura em Haiku) |
| 3 | Plano | Qual o menor caminho seguro? | `design.md`/`tasks.md` ou plano inline | Tarefas pequenas, cada uma com teste, seguindo as convenções do reconhecimento | Opus |
| 4 | Rede de proteção | Se eu quebrar algo, vou perceber? | `protecao.md`, commit de caracterização | Linha de base conhecida; comportamento tocado coberto por teste | Sonnet |
| 5 | Implementação | A feature funciona seguindo os padrões do projeto? | código, testes, um commit por tarefa, na branch | Gate de cada tarefa verde; nenhuma falha nova além das preexistentes | Sonnet |
| 6 | Verificação | Funciona de verdade, sem regressão e sem risco novo? | `validation.md` (PASS), revisão do diff, `seguranca.md` se aplicável | PASS, revisão sem bloqueio, sem achado crítico ou alto | Sonnet |
| 7 | Integração | Como entra no projeto? | contexto do projeto atualizado, `integracao.md` | Integrada da forma escolhida pelo usuário | Sonnet |

## Laços comuns

- Reconhecimento mostra mudança grande de arquitetura → refatorar antes (skill `refatoracao`, com **Chamado por** a feature; depois, reconhecimento refeito), reduzir escopo ou seguir com risco registrado.
- Suíte já vermelha antes de começar → registrar falhas preexistentes ou corrigir antes (fluxo de bug).
- Falha nova durante a implementação → `systematic-debugging`, correção na mesma tarefa.
- Verificador FAIL ou revisão com bloqueio → tarefa de correção, volta à fase 5 (até 3 rodadas; depois, escala ao usuário).
