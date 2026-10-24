# Verificação e integração (fase 9, por etapa)

Responde: **funciona, é acessível, está igual ao mockup e nada mudou por trás?** Quem construiu não verifica: o `verificador` parte do zero.

## 1. Pedido ao `verificador` (modo redesign)

Despache o agente com:

- pasta `.specs/redesign/<slug>/`, etapa `<N>`, intervalo `<base>..<ponta da branch da etapa>`, telas da etapa;
- `redesign.md` (o que não muda), `inventario-telas.md` (comportamento a manter das telas), `migracao.md` (flag, como ligar no teste, código novo, testes aprovados para mudar), `protecao.md`, `tasks.md`, o `telas.json` do mockup e o comando de subir o app;
- saída em `.specs/redesign/<slug>/validation-etapa-<N>.md`.

O que ele confere, nesta ordem:

1. **Testes intactos**: `git diff <base>..<ponta> -- <arquivos de teste>` só acrescenta, salvo as mudanças aprovadas em `migracao.md`. Teste alterado, pulado ou apagado sem aprovação é **FAIL**.
2. **Suíte inteira** verde com a flag **desligada e ligada**, sem falha nova além das preexistentes.
3. **Regras iguais**: cada parte do diff nas telas da etapa sem mudança de regra — mesmos campos enviados, mesmas chamadas e parâmetros, mesmas validações e mensagens de regra, mesmas permissões e navegação (salvo a navegação que `redesign.md` pôs no escopo). Mudança é FAIL, com `arquivo:linha`.
4. **Antiga intacta**: arquivos da interface antiga só mudam na costura da flag.
5. **Sensor de discriminação** numa cópia isolada, na tela nova: remover um campo, inverter uma validação, trocar o destino de uma ação, esconder a mensagem de erro. Os testes de comportamento com a flag ligada têm de pegar; sobrevivente é lacuna da rede, que vira tarefa de teste antes de integrar.
6. **Tokens**: `checar-tokens.py` nos caminhos do código novo, limpo.
7. **Visual**: `comparar-visual.mjs` das telas da etapa, rodado de novo por ele (subindo o app localmente com `--iniciar`, nunca contra produção), comparado com o limite de cada tela e com as diferenças aceitas em `migracao.md`.
8. **Acessibilidade automática**, se o projeto tem a ferramenta: zero violação crítica.
9. **Escopo**: cada arquivo do diff se explica por uma tarefa da etapa.

Grave `validation-etapa-<N>.md` com PASS ou FAIL e a evidência de cada item. O `validate_state.py` do tlc não se aplica.

## 2. O que a sessão confere com o usuário

- **Acessibilidade manual** da etapa (lista de [acessibilidade.md](acessibilidade.md), "Como verificar"): teclado, leitor de tela no fluxo principal, zoom, 320 px, movimento reduzido. Feita pela sessão quando houver navegador automatizável; o leitor de tela e o aparelho real, em geral, pelo usuário, com o resultado confirmado via `AskUserQuestion`. Grave a seção da etapa em `acessibilidade.md`.
- **Navegadores e dispositivos** de `redesign.md`: `comparar-visual.mjs --navegador firefox` e `--navegador webkit` nas telas da etapa (se o projeto tem esses navegadores do Playwright), e um celular real pelo usuário.
- **Teste com usuários** (recomendado nas etapas dos fluxos principais, antes de liberar): as mesmas tarefas do roteiro de [pesquisa.md](pesquisa.md), com a flag ligada para as pessoas do teste (ligar para elas é ação externa, com confirmação). Resultado em `pesquisa.md`, seção da etapa.

## 3. Revisão em modo curto

Com PASS, grave `.specs/revisoes/redesign-<slug>-etapa-<N>/revisao.md` no formato da skill `revisao-codigo` (`revisao-codigo/references/admissao.md`):

- **Modo** `curto` · **Chamado por** `fluxo 7 <slug> etapa <N>` · **Usar em** `.specs/redesign/<slug>/validation-etapa-<N>.md` · **Devolver após** `análise` · **Fases** 4, 7 e 8;
- **Pedido**: origem `redesign.md` e `migracao.md`; critérios: (1) a tela reproduz o mockup aprovado com os componentes do guia; (2) nenhuma regra de negócio muda; (3) só tokens no código novo; (4) a interface antiga muda só na costura; (5) a flag desligada mostra a interface de hoje.

Acione a skill `revisao-codigo`. Mudança de regra achada é **bloqueante**. Se a etapa tocar login, permissões, pagamento ou dados pessoais (formulários costumam tocar), despache também o `auditor-seguranca` (relatório em `.specs/redesign/<slug>/seguranca.md`).

## 4. Integração da etapa

1. **Checagem final**: na branch, com tudo commitado, `python .claude/scripts/trava-testes.py --rodar`; mostre o resultado. Falha volta à fase 8.
2. **Forma de integrar** via `AskUserQuestion`: **merge local**, **PR no GitHub** (push e PR são ações externas, com confirmação) ou **manter a branch**; execute com `finishing-a-development-branch`. A tela entra **inerte**: flag desligada em produção.
3. Acrescente a entrada da etapa em `.specs/redesign/<slug>/integracao.md`: data, etapa, forma, commit, suíte na checagem final, comparação visual (link do `resumo.md`), acessibilidade (crítica: 0; séria: N aceitas com prazo), flag em produção `desligada`.
4. Situação da etapa `integrada` em `redesign.md`.

FAIL, bloqueio da revisão ou violação crítica: tarefa de correção e volta à fase 8 (até 3 rodadas; depois, escala ao usuário).
