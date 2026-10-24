---
name: arqueologia
description: Em código legado (antigo, pouco testado, autores ausentes), reconstitui como o trecho que vai mudar funciona de fato e onde é seguro mexer — ambiente (roda?), histórico do git, comportamento observado em execução, conhecimento de pessoas, costuras para inserir código novo sem alterar o antigo, raio de impacto, staging e feature flags — gravando .specs/features/<feature>/arqueologia.md. Use depois do reconhecimento numa feature em legado, ou quando a skill legado mandar. Não planeja nem altera código.
model: opus
effort: high
---

# Arqueologia (fases 2 e 3 do legado)

Responde: **como esta parte do sistema funciona de verdade, e por onde posso entrar sem mexer no que funciona há anos?** No legado o conhecimento se perdeu; é preciso reconstituí-lo antes de mudar qualquer coisa.

Rende melhor em **Opus**. Se a sessão estiver em outro modelo, avise: "A arqueologia rende melhor em Opus: use `/model opus`."

## Pré-requisitos

Rode antes, nesta ordem, se ainda não existirem: skill `inventario` (projeto) e skill `reconhecimento` (feature). A arqueologia **complementa** o reconhecimento com o que só o legado exige. Em refatoração de trecho legado (skill `refatoracao`), a pasta é `.specs/refatoracoes/<slug>/` e as costuras servem para o código novo nascer ao lado do antigo.

## 1. Ambiente: o projeto roda?

Se houver `.specs/documentacao/*/execucao.md` (skill `documentar`), parta dele e confira se ainda vale. Tente instalar e rodar seguindo o que estiver escrito. Registre versões (linguagem, runtime, banco), dependências sem suporte, passos manuais de build e o que precisou ser descoberto. **Se não roda, fazê-lo rodar vira a primeira tarefa do plano**: sem isso, não há rede de proteção.

## 2. Histórico

Para os arquivos do trecho (do `reconhecimento.md`), use `git log` (pode delegar ao `leitor-codigo`):

- quem mexeu, quando foi a última mudança, com que frequência muda (arquivo que muda muito é ponto quente);
- commits de correção de bug no trecho (indicam fragilidade);
- mensagens que explicam **por que** algo é como é.

## 3. Comportamento observado

Execute o fluxo afetado localmente (ou leia logs, se for só o que existe) e registre o que o sistema **faz**, inclusive o estranho: valores especiais, efeitos colaterais, dependência de ordem, dados que só funcionam em certo formato. Isso alimenta os testes de caracterização.

## 4. Conhecimento de pessoas

Pergunte ao usuário via `AskUserQuestion` (com "Ainda não sei"): quem conhece esse trecho, se há documentação fora do repositório, e as dúvidas que o código não responde. O que ninguém souber fica `[A ESCLARECER]` e vira risco.

## 5. Costuras e raio de impacto

- **Costuras:** pontos onde o código novo entra **ao lado** do antigo, sem alterá-lo: interface ou classe base, evento, rota nova, configuração, adaptador, decorator, gancho de framework. Escolha um **ponto único de integração**.
- **Raio de impacto:** quem depende do que será tocado: outras telas, tarefas agendadas, relatórios, integrações com outros sistemas, dados compartilhados.

## 6. Ambientes e liberação

Pergunte via `AskUserQuestion` (com "Ainda não sei"): existe **staging** ou só produção? Existe mecanismo de **feature flag** no projeto (veja também o inventário)? Como se faz deploy hoje? Isso define a fase de liberação.

## 7. Saída de emergência

Se o impacto for alto demais (sem costura possível, raio enorme, nada roda), **pare** e pergunte via `AskUserQuestion`: refatorar antes (skill `refatoracao`), construir a funcionalidade como serviço novo ao lado do legado (estrangular aos poucos), reduzir o escopo, ou seguir com o risco registrado.

## 8. Gravar `arqueologia.md`

```markdown
# Arqueologia: <feature>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto>

## Ambiente
- **Roda?** sim | não (primeira tarefa: <o que fazer>)
- **Versões**: <...> · **Passos não documentados**: <...>

## Histórico do trecho
| Arquivo | Última mudança | Frequência | Correções de bug | Observação |
|---|---|---|---|---|

## Comportamento observado
- <comportamento, inclusive estranho> — como observado: <execução | log>

## Conhecimento
- **Quem conhece**: <... | ninguém>
- **Dúvidas sem resposta**: [A ESCLARECER: ...]

## Costuras e integração
- **Ponto único de integração**: `arquivo:linha` — <como o código novo entra ao lado>
- **Outras costuras possíveis**: <...>

## Raio de impacto
- <dependente> — <como pode ser afetado>

## Ambientes e liberação
- **Staging**: sim | não · **Feature flag**: <mecanismo | nenhum> · **Deploy hoje**: <como>

## Riscos
| Risco | Impacto | Mitigação |
|---|---|---|
```

## Ao terminar

Responda com o caminho, se o ambiente roda, o ponto único de integração, o raio de impacto, staging e flag, e os 3 maiores riscos. Pergunte via `AskUserQuestion`: **seguir para a rede de proteção / ajustar / parar**.

## Regras

- Somente leitura no código (rodar a aplicação localmente é permitido); escreva só o `arqueologia.md`.
- Toda afirmação sobre o código cita `arquivo:linha`.
- Tudo em português.
