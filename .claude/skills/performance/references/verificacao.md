# Verificação (fase 7)

Responde: **a meta foi atingida sem regressão?** Quem otimizou não verifica: o `verificador` parte do zero e repete a medição ele mesmo.

## 1. Pedido ao `verificador` (modo performance)

Despache o agente com:

- pasta `.specs/performance/<slug>/`, rodada `<N>`, intervalo `<base>..<ponta da branch>`;
- `performance.md` (meta, cenário, ambiente, guardas), `medicoes.md` (linha de base, comando, condições), `diagnostico.md`, `opcoes.md` (o que muda comportamento, aprovado), `protecao.md` e `tasks.md`;
- o ambiente onde medir (o mesmo da linha de base) e a proibição: **nenhuma carga contra produção ou serviço de terceiro**;
- saída em `.specs/performance/<slug>/validation-rodada-<N>.md`.

O que ele confere, nesta ordem:

1. **Testes intactos:** `git diff <base>..<ponta> -- <arquivos de teste>` só acrescenta. Teste existente alterado, pulado ou apagado é **FAIL**, salvo motivo registrado e aprovado pelo usuário.
2. **Suíte inteira** verde, sem falha nova além das preexistentes de `protecao.md`.
3. **Comportamento:** cada mudança mantida não altera nada observável além do aprovado em `opcoes.md` (retorno, ordem, erro, efeito, formato). Mudança aprovada tem teste do critério de aceite. Mudança não aprovada é FAIL, com `arquivo:linha`.
4. **Sensor de discriminação** numa cópia isolada: falhas pequenas no código otimizado (inverter condição, trocar a chave do cache, remover a invalidação, devolver a lista sem o filtro). A caracterização e os testes das tarefas têm de pegá-las; sobrevivente é lacuna da rede.
5. **Commits revertidos** de fato revertidos: a ponta não contém as mudanças marcadas **revertida** em `medicoes.md`.
6. **Medição independente:** o roteiro de `carga/` com o mesmo comando, ambiente, dados, aquecimento e número de repetições da linha de base. Mediana e faixa da métrica da meta e das guardas, lado a lado com a linha de base. Também **custo e recursos** (CPU, memória, conexões, custo mensal estimado se mudou infraestrutura).
7. **Meta:** atingida se a mediana alcança o alvo **e** o critério de ganho confirmado de `medicao.md` vale contra a linha de base. Diferença grande entre a medição dele e a da sessão na fase 6 é achado (ambiente instável ou medição errada).
8. **Escopo:** cada arquivo do diff se explica por uma tarefa; instrumentação temporária esquecida é achado.

Grave `validation-rodada-<N>.md` com PASS ou FAIL, a tabela de números e a evidência de cada item. O `validate_state.py` do tlc não se aplica. PASS com meta não atingida é possível (nada quebrou, mas não bastou).

## 2. Revisão em modo curto

Com PASS, grave `.specs/revisoes/performance-<slug>-rodada-<N>/revisao.md` no formato da skill `revisao-codigo` (`revisao-codigo/references/admissao.md`):

- **Modo** `curto` · **Chamado por** `fluxo 5 <slug> rodada <N>` · **Usar em** `.specs/performance/<slug>/validation-rodada-<N>.md` · **Devolver após** `análise` · **Fases** 4, 7 e 8;
- **Pedido**: origem `performance.md` e `opcoes.md`; critérios de aceite: (1) cada mudança mantida é a da sua tarefa; (2) nada observável muda além do aprovado; (3) sem risco novo de concorrência, vazamento de memória, cache servindo dado de outro usuário ou consulta que piora com mais dados.

Acione a skill `revisao-codigo`. Mudança de comportamento não aprovada é **bloqueante**.

Se a rodada mexer em cache com dado por usuário ou pessoal, autenticação, permissões ou pagamento, despache também o `auditor-seguranca` (relatório em `.specs/performance/<slug>/seguranca.md`).

## 3. Fechar

- **FAIL ou bloqueio:** tarefa de correção e volta à fase 6 (até 3 rodadas de correção; depois, escala ao usuário).
- **PASS e meta atingida:** **Meta atingida** `sim — <valor> (<data>, commit <hash>)`; segue para a fase 8.
- **PASS e meta não atingida:** mostre quanto falta e pergunte via `AskUserQuestion`: **nova rodada de diagnóstico (Recomendado)** (o gargalo mudou de lugar depois da correção), **aceitar como meta parcial** (com motivo; segue para a fase 8 com o ganho obtido) ou **parar**. Nova rodada: **Meta atingida** `não — rodada <N+1>` e os campos de rodada voltam a `pendente`. Na terceira rodada sem a meta, a primeira opção vira a **saída arquitetural**.
