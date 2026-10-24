# Execução assistida (fase 7)

Responde: **posso confiar sem olhar?** A automação roda no mundo real, mas alguém confere tudo antes de ela agir sozinha.

## Antes da primeira rodada

1. **Modo** (pergunte via `AskUserQuestion`, recomendando pelo risco de `desenho.md`):
   - **Sombra** (recomendado quando a simulação lê os dados reais): a automação roda em simulação ao lado do processo manual, que continua sendo o que vale; compara-se o que ela faria com o que a pessoa fez.
   - **Aprovação antes de agir** (quando não há simulação possível, ou o manual deixa de ser feito): a automação prepara as ações e a pessoa aprova a lista antes de cada execução.
   - Os dois em sequência: sombra primeiro, depois aprovação, quando há ação irreversível.
2. **Critério de confiança**, escrito antes: quantas rodadas (ou dias) e que concordância (ex.: "4 execuções semanais seguidas sem divergência no caminho comum e todas as exceções separadas"). Com ação irreversível, nunca menos de 3 rodadas.
3. **Onde roda**: no ambiente real, com a credencial da automação. Ler dados reais e, no modo aprovação, agir sobre eles é **ação externa**: confirme o modo, o ambiente e o teto via `AskUserQuestion` antes da primeira rodada. Em produção com usuários, se o código precisar estar lá, ele vai **inerte** pela skill `liberacao` (estratégia: desligado), e ligar fica para a fase 8.
4. Saídas brutas com dado real ficam em `evidencias/`, fora do git (`.specs/automacoes/*/evidencias/` no `.gitignore` do projeto, com o diff mostrado).

## Cada rodada

- Rode, colete o relatório da automação e o resultado manual (ou a lista aprovada e o que ela fez).
- Compare item a item: igual, diferente (com causa), exceção bem separada, exceção perdida.
- Divergência:
  - causa na **automação** → teste que reproduz, correção (fase 6, pela mesma skill), nova rodada;
  - causa no **processo** (passo ou exceção que a descrição não tinha) → atualize `processo.md` e `desenho.md` só nesse ponto e decida com o usuário se entra no escopo;
  - causa no **manual** (a pessoa errou) → anote; é ganho da automação, não defeito.
- Confira também: duração, custo por execução, relatório e alertas chegando no canal certo.

## Saída

- Critério atingido → fase 8.
- Três rodadas seguidas sem atingir → escale ao usuário via `AskUserQuestion`: reduzir o escopo ao que concorda (recomendado), manter aprovação humana permanente, parar.

## Modelo de `execucao.md`

```markdown
# Execução assistida: <processo>

- **Modo**: <sombra | aprovação antes de agir | sombra, depois aprovação> · **Ambiente**: <...> · **Teto**: <...>
- **Critério de confiança**: <...> · **Atingido**: <pendente | sim (AAAA-MM-DD) | não — <decisão>>

## Rodadas

| # | Data | Itens | Iguais | Diferentes | Exceções separadas | Exceções perdidas | Duração | Custo |
|---|---|---|---|---|---|---|---|---|

## Divergências

| Rodada | Item | O que houve | Causa (automação, processo, manual) | Ação (teste e correção, escopo, nota) |
|---|---|---|---|---|

## Casos de teste do serviço pronto (sem código)

| Caso | Entrada | Esperado | Obtido | Data |
|---|---|---|---|---|
```
