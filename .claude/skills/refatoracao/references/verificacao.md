# Verificação (fase 7)

Responde: **melhorou de verdade, e nada mudou por fora?** Quem executou não verifica: o `verificador` parte do zero.

## 1. Pedido ao `verificador` (modo refatoração)

Despache o agente com:

- pasta `.specs/refatoracoes/<slug>/`, etapa `<N>`, intervalo `<base>..<ponta da branch da etapa>`;
- `refatoracao.md` (alvo, fora do escopo, meta e comando da métrica, limite de desempenho), a seção **Contratos e acoplamento** do `reconhecimento.md`, `protecao.md` e `tasks.md`;
- saída em `.specs/refatoracoes/<slug>/validation-etapa-<N>.md`.

O que ele confere, nesta ordem:

1. **Testes intactos:** `git diff <base>..<ponta> -- <arquivos de teste>` só acrescenta. Teste de caracterização ou teste que já existia alterado, pulado ou apagado é **FAIL**, salvo motivo registrado e aprovado pelo usuário.
2. **Suíte inteira** verde, sem falha nova além das preexistentes de `protecao.md`.
3. **Contratos iguais:** para cada contrato da lista, compare antes e depois (assinatura exportada, rota e formato, erro, efeito colateral e ordem, dados lidos por outros). Cada parte do diff precisa ser **sem mudança observável**: retorno, erro lançado, efeito que quem chama vê, estado, ordem de iteração, mensagem emitida. Mudança observável é FAIL, com `arquivo:linha`.
4. **Sensor de discriminação** numa cópia isolada: falhas pequenas no código refatorado (inverter condição, mudar retorno, erro de um, remover um efeito). A caracterização tem de pegá-las; sobrevivente é **lacuna da rede de proteção**, que vira tarefa de teste antes de integrar.
5. **Meta:** rode o comando da métrica e registre o valor da etapa ao lado do **antes**. Na última etapa, compare com o **alvo**.
6. **Desempenho**, se `refatoracao.md` tiver linha de base: mesmo comando, mesmas condições, valor comparado com o limite de piora.
7. **Escopo:** cada arquivo do diff se explica por uma tarefa; mudança fora do alvo é achado.

Grave `validation-etapa-<N>.md` com PASS ou FAIL e a evidência de cada item. O `validate_state.py` do tlc não se aplica.

## 2. Revisão em modo curto

Com PASS, grave `.specs/revisoes/refatoracao-<slug>-etapa-<N>/revisao.md` no formato da skill `revisao-codigo` (`revisao-codigo/references/admissao.md`):

- **Modo** `curto` · **Chamado por** `fluxo 13 <slug> etapa <N>` · **Usar em** `.specs/refatoracoes/<slug>/validation-etapa-<N>.md` · **Devolver após** `análise` · **Fases** 4, 7 e 8;
- **Pedido**: origem `refatoracao.md`; critérios de aceite: (1) a estrutura chega à meta da etapa; (2) nenhum comportamento observável muda; (3) nada fora do alvo é tocado.

Acione a skill `revisao-codigo`. Qualquer mudança de comportamento achada é **bloqueante**. Sugestão de "melhorar mais" que não está na meta vira dívida em `dividas.md`, não tarefa.

Se a etapa tocar login, permissões, pagamento ou dados pessoais, despache também o `auditor-seguranca` (o relatório vai para `.specs/refatoracoes/<slug>/seguranca.md`).

## 3. Fechar

Registre em `refatoracao.md` a linha da etapa em **Métrica por etapa**; na última etapa, preencha **Métrica depois**. Bloqueante, FAIL ou desempenho acima do limite: tarefa de correção e volta à fase 6 (até 3 rodadas; depois, escala ao usuário). Meta não atingida no fim do plano: pergunte via `AskUserQuestion`: **mais uma etapa** (volta à fase 5), **aceitar como meta parcial** (com motivo) ou **parar**.
