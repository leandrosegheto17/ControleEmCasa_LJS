# Validação e manutenção (fase 9)

Responde: **está correto e vai continuar?** Seguir o próprio guia do zero é o melhor teste. Quem escreveu não valida: um agente sem contexto segue a documentação e registra onde ela falha.

## 1. Preparar a rodada

1. Na branch `docs/<slug>`, com toda a documentação commitada (`docs: ...`), anote o commit.
2. Crie um **worktree limpo** desse commit fora da árvore (`git worktree add <pasta temporária> <commit>`, com `using-git-worktrees`).
3. Escolha com o usuário, via `AskUserQuestion`, quem valida: **agente `verificador` em modo documentação** (recomendado: sem contexto desta sessão, independente de quem escreveu); **sessão nova** do Claude Code aberta pelo usuário no worktree, com o mesmo pedido; ou **uma pessoa** (registre o retorno dela no mesmo formato).

## 2. Pedido ao `verificador` (modo documentação)

Passe **só** isto, sem resumo do que a sessão descobriu (o agente parte do zero):

```
Modo documentação. Pasta da documentação: .specs/documentacao/<slug>/ (grave só validacao.md ali).
Worktree limpo: <caminho>, commit <hash>. Público: <público de documentacao.md>.
Documentos a seguir, na ordem: <README.md, docs/...>. Contexto para IA: <CLAUDE.md | AGENTS.md>.

Tarefas, usando SOMENTE o que está escrito nesses documentos:
1. Instalar do zero no worktree (pré-requisitos, dependências, configuração).
2. Rodar a suíte de testes como a documentação manda.
3. Subir a aplicação e confirmar que responde como descrito.
4. Executar os fluxos <1 a 3 fluxos de docs/fluxos.md> e comparar com o descrito.
5. Conferir uma amostra de <10> afirmações (comandos, caminhos, setas do diagrama, regras citadas, linhas do arquivo de contexto) contra o código.

Quando um passo falhar, faltar ou for ambíguo: registre antes de improvisar (documento:linha, o que estava escrito, o comando, o que aconteceu). Só depois investigue o código para sugerir a correção, marcando-a como sugestão.
Limites: não instalar nada fora do worktree; segredo ausente é achado (a doc diz de onde vem?), não peça nem invente valor; nada contra produção ou serviço de terceiro; não altere arquivos do projeto.
```

## 3. Classificar o retorno

| Achado | Significado | O que fazer |
|---|---|---|
| **falha** | o passo como escrito não funciona | corrigir o documento |
| **lacuna** | faltou um passo ou informação | acrescentar |
| **ambiguidade** | dava para entender de mais de um jeito | reescrever |
| **afirmação falsa** | a amostra não bate com o código | corrigir ou marcar `não verificado` |
| **ambiente** | pré-requisito declarado e ausente na máquina | não é falha da doc; confirmar que está declarado |

Corrija na branch, novo commit `docs:`, remova o worktree e faça **nova rodada** num worktree novo. Passa quando a rodada não tem falha, lacuna nem afirmação falsa (ambiguidade menor pode ficar, registrada). Três rodadas sem passar: pergunte ao usuário (seguir com as lacunas marcadas, rever o escopo, ou parar).

## 4. Manutenção

Defina com o usuário, via `AskUserQuestion`, e grave na seção **Manutenção** de `documentacao.md`:

- **Na mesma mudança**: a linha "atualize na mesma mudança" do arquivo de contexto e, se houver modelo de PR, um item "documentação atualizada?". As skills `feature` e `legado` já atualizam o contexto na integração.
- **Checagem automática** (proposta, com aprovação; mudança no CI é commit próprio): links internos dos documentos, e os comandos do "Como rodar" executados no CI quando for barato.
- **Revisão periódica**: data sugerida (ex.: a cada 6 meses, ou depois de uma mudança grande de arquitetura ou de dependência), feita por uma nova execução desta skill em modo `revisão`.
- **Dono**: quem responde pela documentação (`[A ESCLARECER]` se ninguém).

## 5. Integrar

1. **Checagem final:** na branch, com tudo commitado, rode `python .claude/scripts/trava-testes.py --rodar` e mostre o resultado. A documentação não muda comportamento, mas a trava vale para todo merge, push e PR. Projeto sem testes (`testes.json` ausente ou `dispensado` não aprovado): pergunte via `AskUserQuestion`: criar a infraestrutura mínima de testes antes, como trabalho separado (recomendado, regra de testes do projeto), registrar a dispensa com motivo (só com aprovação), ou manter a branch sem integrar.
2. **Forma de integrar:** pergunte via `AskUserQuestion`: **merge local**, **PR** (push e abertura são ações externas, com confirmação) ou **manter a branch**; execute com `finishing-a-development-branch`.
3. Atualize o inventário se a documentação criou peça reaproveitável (modelo de PR, checagem no CI).
4. Em `documentacao.md`: situação de cada documento `validado`, a fase 9 `feita`, e **Resultado** `concluída`. Chamado por outro fluxo: responda ao chamador.

## Modelo de `validacao.md`

```markdown
# Validação: <slug>

## Rodada <N> — <AAAA-MM-DD> · commit <hash> · por <verificador | sessão nova | pessoa>
- **Resultado**: passou | não passou
- **Instalar**: <ok | falhou no passo X> · **Testes**: <comando → resultado> · **Aplicação**: <ok | falhou> · **Fluxos**: <N/N conforme>
- **Amostra**: <M/N afirmações conferidas sem divergência>

| # | Tipo | Documento:linha | Escrito | Aconteceu | Sugestão | Corrigido em |
|---|---|---|---|---|---|---|
```
