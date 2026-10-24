---
name: rede-de-protecao
description: Antes de alterar código existente, garante que uma quebra será percebida — roda a suíte atual como linha de base, separa falhas que já existiam, e escreve testes de caracterização do comportamento atual que será tocado e ainda não tem teste, gravando .specs/features/<feature>/protecao.md. Use depois do plano e antes da implementação de uma feature, refatoração, correção de bug ou mudança em legado, ou quando o orquestrador mandar. Não implementa a mudança.
---

# Rede de proteção

Responde: **se eu quebrar algo, vou perceber?** A mudança só começa com a linha de base conhecida e o comportamento que será tocado coberto por teste.

## Pré-requisitos

- `reconhecimento.md` da feature (comando da suíte, o que não tem teste) e o plano aprovado (`tasks.md` ou `design.md`, ou o plano inline).
- Em correção de bug, a pasta é `.specs/bugs/<slug>/`, o plano é a causa e a correção prevista em `causa.md`, e o teste do bug (ainda vermelho) é a **falha esperada** da linha de base, não falha preexistente.
- Em refatoração, a pasta é `.specs/refatoracoes/<slug>/` e a rede vem **antes** do plano: o que se caracteriza é o alvo de `refatoracao.md` e **todos** os contratos da seção "Contratos e acoplamento" do `reconhecimento.md`, porque a refatoração promete não mudar nada observável.
- Em performance, a pasta é `.specs/performance/<slug>/` e o plano é o `tasks.md` da rodada: caracterize o comportamento do caminho que as mudanças vão tocar (saída, ordem, erros, efeitos), porque otimizar não muda resultado. A linha de base de **desempenho** já está em `medicoes.md`; aqui é a da suíte.
- Em redesign, a pasta é `.specs/redesign/<slug>/` e o plano é `migracao.md` com `tasks.md`: caracterize, pela interface, o comportamento a manter de cada tela do escopo (`inventario-telas.md`), com cada teste rodando **com a flag desligada e ligada** e elementos achados por papel, rótulo e texto (nunca por classe CSS), porque a regra de negócio não pode mudar e a marcação vai mudar.
- **Branch isolada já criada** para a mudança (ou crie agora, com `using-git-worktrees` se o usuário preferir worktree). Os testes de caracterização entram nessa branch.

## 1. Linha de base

1. Rode a suíte com o comando do `reconhecimento.md`. Sem suíte ou sem infraestrutura de testes: a **primeira tarefa** passa a ser criar uma mínima (framework de testes do ecossistema do projeto, um teste que roda) e ela entra antes de tudo.
2. Registre: total, passaram, falharam, ignorados, tempo.
3. Falhas: rode de novo só as que falharam. As que passam na segunda vez são **instáveis**; as que falham de novo são **falhas preexistentes**.
4. Com falha preexistente, pergunte via `AskUserQuestion`:
   - **Registrar e seguir**: viram lista conhecida; a mudança não pode aumentar essa lista.
   - **Corrigir antes** (fluxo de bug), se a falha está no trecho que será tocado.
   - **Parar.**

## 2. Testes de caracterização

Para cada comportamento que **será tocado** e **não tem teste** (lista do `reconhecimento.md`, cruzada com o plano):

- Escreva um teste que registra **o que o sistema faz hoje**, mesmo que pareça errado. Comportamento estranho é registrado e anotado, não corrigido aqui.
- Prefira testar pela entrada e saída públicas (rota, função exportada, tela) a testar detalhes internos.
- Todos precisam **passar** no código atual. Se não passarem, o teste está errado, não o código.

Muitos testes ou trecho complexo: despache o `implementador` com a lista. Faça **um commit separado** antes de qualquer mudança: `test: caracterização de <trecho> antes de <feature>`.

Não escreva testes para o que não será tocado: a rede cobre o trecho da mudança, não o projeto inteiro.

## 3. Gravar `protecao.md`

```markdown
# Rede de proteção: <feature>

- **Data**: <AAAA-MM-DD> · **Branch**: <nome> · **Commit da caracterização**: <hash | nenhum>

## Linha de base

- **Comando**: `<comando>`
- **Resultado**: <N> passaram, <N> falharam, <N> ignorados, <tempo>
- **Instáveis**: <lista | nenhum>
- **Falhas preexistentes** (não podem aumentar): <lista | nenhuma> — decisão: <registrar e seguir | corrigir antes>

## Caracterização

| Comportamento tocado | Teste | Observação |
|---|---|---|
| <...> | `arquivo:linha` | <comportamento estranho registrado, se houver> |
```

## Ao terminar

Responda com a linha de base em uma linha, quantos testes de caracterização foram criados e as falhas preexistentes, e pergunte via `AskUserQuestion`: **seguir para a implementação / ajustar / parar**.

## Regras

- Não altere código de produção nesta etapa; só testes (e a infraestrutura de testes, se faltar).
- Nunca apague nem enfraqueça um teste existente.
- Tudo em português.
