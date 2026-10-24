# Plano em passos e execução (fases 5 e 6)

## Fase 5: plano

Acione o `tlc-spec-driven` (Tasks; e Design antes, no modo grande) passando `refatoracao.md` como "spec": a meta é a estrutura de chegada e o **comportamento inalterado** é o critério de aceite de toda tarefa. O `tasks.md` fica em `.specs/refatoracoes/<slug>/`; rode `validate_tasks.py` nesse caminho antes da aprovação.

### Como quebrar

- **Cada passo termina com o sistema funcionando** e a suíte inteira verde. Passo que não cabe em poucas horas é quebrado.
- **Um tipo de mudança por passo**: renomear, mover, extrair (função, módulo, tipo), juntar duplicação, introduzir uma interface, trocar quem chama para a interface, apagar o que ficou sem uso. Renomear e mudar lógica no mesmo passo esconde o erro.
- **Preferir camadas paralelas a reescrever:** o novo nasce ao lado do antigo, as chamadas migram aos poucos, e o antigo só sai quando ninguém mais o usa.
- **Último passo apaga o antigo**, depois de confirmar que não sobrou uso (busca e caracterização verdes).
- Nenhum passo muda contrato da lista do mapeamento. Se um passo precisaria mudar, o plano está errado ou não é refatoração.

### Campos de cada tarefa (formato do `tasks.md` do tlc)

- **O que muda** e **arquivos**;
- **Tests**: a caracterização de `protecao.md` que cobre o passo (refatoração não cria teste de comportamento novo; teste de unidade da peça extraída é bem-vindo e entra no mesmo commit);
- **Gate**: o comando da suíte inteira de `.specs/projeto/testes.json`, verde, e nenhum teste de caracterização alterado;
- **Reverter**: `git revert <commit do passo>` (ou desligar a flag, no modo grande);
- **Commit**: `refactor(<escopo>): <passo> (<slug>)`.

### Etapas

Etapas são as fases do `tasks.md`. Cada etapa é **integrável sozinha** (fase 8) e deixa o sistema melhor que antes, mesmo que as seguintes nunca aconteçam. Modo pequeno: uma etapa. Modo grande: etapas de até ~8 tarefas, na ordem do mapeamento (começa pelo que tem menos dependentes; o que todos usam vai por último).

### Modo grande: novo ao lado do antigo

Escolha o padrão pelo caso e registre em `design.md`, com a costura (`arquivo:linha`), o mecanismo de troca e como voltar:

| Situação | Padrão | Como funciona |
|---|---|---|
| trocar implementação interna (biblioteca própria, algoritmo, SDK), sem sair do mesmo deploy | **ramificar por abstração** | interface para o que será trocado; todas as chamadas passam a usar a interface; o antigo fica atrás dela; o novo é construído atrás da mesma interface; uma flag escolhe; o antigo sai |
| separar um módulo do resto | **extração com adaptador** | interface da capacidade; adaptador que delega ao antigo; o novo atrás da mesma interface; os dois passam nos mesmos testes de contrato |
| rotas HTTP | **roteador na frente** | uma camada decide, rota por rota, se vai para o antigo ou o novo; voltar é rotear de novo para o antigo |
| esquema ou banco de dados | **escrita dupla** | o novo vira a fonte da verdade; o antigo é atualizado em paralelo; leitura tenta o novo; dados antigos migrados aos poucos e conferidos; migração reversível e backup |
| tela (troca de framework) | **componente a componente** | os dois convivem; troca por rota ou página inteira; estado compartilhado por uma ponte |
| mensagens e eventos | **interceptação** | o produtor emite para os dois consumidores; o novo processa em paralelo; consumidor idempotente; o antigo sai |

Na dúvida dentro do mesmo deploy, ramificar por abstração. Sem testes possíveis no antigo (saída de emergência): **execução paralela**, em que o novo roda junto com o antigo, o resultado do antigo é o que vale, e as diferenças são registradas até a taxa combinada no `design.md`; só então o novo assume.

Quando a troca passa por usuários de verdade, as etapas seguem a sequência **preparar → sombra (0%, comparando) → canário (5 a 10%) → ampliar → 100% → limpeza (apagar o antigo)**, cada uma com critério para avançar e gatilho para voltar **uma** etapa. Isso é feito pela skill `liberacao` na fase 8; a limpeza não tem volta e exige confirmação específica.

Mudança de dados em produção é ação difícil de desfazer: backup antes, migração reversível testada e confirmação específica.

## Fase 6: execução

`tlc-spec-driven`, fase Execute, na branch da etapa, com `implementador` (passo mecânico) ou `implementador-dominio` (trecho com regra de negócio difícil). Passe aos trabalhadores, junto com o lote: `refatoracao.md` (alvo, fora do escopo), a lista de contratos e `protecao.md`.

**Ciclo de cada passo:**

1. Suíte verde antes de começar (nenhuma falha além das preexistentes de `protecao.md`).
2. Fazer **só** o passo da tarefa.
3. Rodar a suíte inteira.
4. Verde e nenhum teste de caracterização alterado: commit do passo. Vermelho: **desfazer o passo** (descartar a mudança ainda não commitada do próprio passo) e refazê-lo menor; se a falha não se explica, `systematic-debugging`.

**Nunca:**

- alterar, pular ou apagar teste de caracterização ou teste que já existia para o passo passar (mudar teste existente exige motivo registrado e aprovação do usuário, `CLAUDE.md`);
- corrigir bug, acrescentar comportamento ou "aproveitar que está aqui": vai para **Achados fora do escopo** em `refatoracao.md`;
- juntar vários passos num commit, ou commitar com a suíte vermelha.

**Parar antes do fim:** a meta foi atingida com os passos já feitos (meça a métrica). Pergunte via `AskUserQuestion` se encerra a etapa ali; os passos restantes viram dívida em `dividas.md`, se ainda valerem.

Ao fim do lote, a suíte inteira roda: nenhuma falha nova além das preexistentes, e `git diff <base>..HEAD --stat -- <pastas de teste>` mostra só testes acrescentados.
