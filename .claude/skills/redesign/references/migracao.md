# Plano de migração (fase 7)

Responde: **em que ordem, convivendo como, e como saberemos que nada mudou por trás?** Entradas: `redesign.md`, `inventario-telas.md`, `reconhecimento.md` (refaça se o código mudou desde a data dele), `sistema.md`, o mockup aprovado.

## 1. Etapas

- **Etapa 1, fundação**: tokens no código, componentes do guia, mecanismo da flag, testes de comportamento nas duas posições, comparação visual e `checar-tokens.py` configurados (no CI, só sobre o código novo). Nenhuma tela muda para o usuário.
- **Etapas 2 a N**: uma tela, ou um **fluxo curto** (telas que o usuário percorre na mesma tarefa: misturar antigo e novo no meio de uma tarefa confunde mais que o redesign ajuda). Cada etapa integrável sozinha.
- **Ordem recomendada**: primeiro uma tela de risco baixo e uso médio (valida a fundação sem expor o fluxo crítico); depois as dos problemas `P-NN` de maior prioridade; por último as de baixo uso. Navegação comum (cabeçalho, menu) decide-se aqui: entra com a primeira etapa liberada ou com a última, nunca pela metade.
- **Etapa R, remoção**: depois da decisão **manter**: apaga a interface antiga, a flag e o CSS antigo; `checar-tokens.py` passa a rodar sobre a interface inteira.

`tlc-spec-driven`, fase **Tasks**, com `tasks.md` na pasta do redesign: cada etapa é uma fase do `tasks.md`; cada tarefa tem teste; rode `validate_tasks.py` no arquivo.

## 2. Coexistência

| Forma | Quando | Como |
|---|---|---|
| **Flag por tela ou rota** (recomendada) | a marcação ou a estrutura da tela muda | a rota escolhe a tela nova ou a antiga pela flag; a antiga não é editada além dessa escolha |
| **Tema por classe na raiz** | só a aparência muda, com a mesma marcação | `<html class="tema-novo">` liga os tokens novos; CSS novo escopado pela classe |
| **Aplicação separada** | reescrita total da interface | só com motivo forte: dobra a manutenção |

- **Flag**: use o mecanismo que o projeto já tem (inventário, reconhecimento). Sem nenhum, o mais simples que permita ligar **por usuário ou grupo** sem novo deploy (a liberação gradual depende disso) e uma forma de ligar no teste (consulta, cookie ou `localStorage`, que vai no bloco `flag` do `telas.json`). Biblioteca ou serviço de flag com alternativas reais: skill `escolha-tecnologia` em modo enxuto.
- **Desligada é o padrão** em produção até a fase 10. Com a flag desligada, o usuário vê exatamente a interface de hoje.
- **Opção de voltar** (o usuário escolhe "visual antigo" durante a transição): recomendada em produto com usuários antigos; vira critério de aceite e tarefa.

## 3. Testes de comportamento (rede de proteção)

Skill `rede-de-protecao` com a pasta `.specs/redesign/<slug>/`, o plano `migracao.md` + `tasks.md` e a branch da etapa 1 (`redesign/<slug>-etapa-1`):

- Caracterize, **pela interface**, o comportamento a manter de cada tela do escopo (lista de `inventario-telas.md`): o que mostra, ações, validações e mensagens, navegação, chamadas feitas.
- Cada teste roda **com a flag desligada e ligada**, com as mesmas asserções (parametrizado). Enquanto a tela nova não existe, a posição ligada cai na antiga e passa; quando ela chega, o teste prova que nada mudou.
- **Encontre elementos por papel, rótulo e texto**, nunca por classe CSS ou estrutura: classe muda no redesign.
- **Testes existentes que usam classe CSS ou estrutura** quebram com a tela nova. Não se apagam nem se alteram sem aprovação: liste-os em `migracao.md`, com a proposta (continuam rodando com a flag desligada; ganha-se um equivalente por papel e rótulo para a ligada) e peça a aprovação nesta fase.
- **Mudança de teste já planejada**: na etapa R, a posição desligada deixa de existir. Registre aqui e peça a aprovação agora, para a remoção não enfraquecer teste sem decisão.

## 4. Comparação visual

- **Automática** com `.claude/scripts/comparar-visual.mjs` se o projeto tem Playwright. Sem ele, pergunte via `AskUserQuestion`: **instalar o Playwright como dependência de desenvolvimento** (Recomendado com mais de ~5 telas; é decisão do usuário), **prints lado a lado** (etapa 3 de sempre da `mockup-visual`, aceite pelo olho do usuário), **parar**.
- **Limite por tela** (`limite` no `telas.json`): calibre na primeira tela da etapa 2 (rode, olhe o `--diff.png` com o usuário, combine o número); ponto de partida 2% (`PREMISSA`). Tamanho de página diferente do mockup sempre diverge.
- A comparação roda **localmente** a cada etapa (fontes e sistema mudam o desenho do texto entre máquinas); no CI, só com imagem de contêiner fixa e decisão do usuário. No CI rodam sempre: testes de comportamento nas duas posições, `checar-tokens.py` no código novo e acessibilidade automática (se aprovada).

## 5. Liberação (planejada aqui, feita na fase 10)

- **Por etapa** (cada fluxo liberado ao integrar; adaptação gradual) ou **ao fim** (tudo junto, uma medição só). Recomendação: por etapa quando os fluxos são independentes.
- **Alcance**: interno → grupo voluntário (beta) → porcentagem → todos.
- **A/B** só quando o tráfego dá amostra para a métrica da meta no prazo; senão, antes e depois com a ressalva escrita.
- **Critério de parada** e **reversão** (desligar a flag, testado) no modelo da skill `liberacao`.

## Modelo de `migracao.md`

```markdown
# Plano de migração: <slug>

- **Coexistência**: <flag por tela | tema por classe | aplicação separada> — <motivo>
- **Flag**: <nome> · **Mecanismo**: <...> · **Ligar no teste**: <consulta | cookie | localStorage> · **Opção de voltar**: <sim | não>
- **Comparação visual**: <automática (Playwright <versão>) | prints lado a lado> · **Limite padrão**: <N%>
- **Tokens no código**: <copiar tokens.css para <caminho> | tema da biblioteca apontando para var(--...)>
- **Código novo em**: <pastas e arquivos que o checar-tokens checa>
- **Liberação**: <por etapa | ao fim> · **A/B**: <sim (métrica, amostra, duração) | não — <motivo>>

## Testes existentes afetados

| Teste | Por que quebra | Proposta | Aprovado |
|---|---|---|---|

## Mudanças de teste planejadas

- Etapa R: testes parametrizados passam a rodar só com a interface nova — aprovado em <data>.

## Riscos

- <risco> — <mitigação>
```

E a tabela **Etapas** em `redesign.md`:

```markdown
| # | Etapa | Telas | Branch | Limite visual | Situação |
|---|---|---|---|---|---|
| 1 | Fundação: tokens, componentes, flag, testes | — | `redesign/<slug>-etapa-1` | — | planejada |
| 2 | <fluxo> | T-03, T-04 | `redesign/<slug>-etapa-2` | 2% | planejada |
| R | Remoção da interface antiga e da flag | todas | `redesign/<slug>-remocao` | — | aguardando decisão |
```
