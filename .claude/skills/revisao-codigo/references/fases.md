# As 10 fases da revisão de código

Princípio: **revisar o que mudou contra o que foi pedido**, com atenção redobrada ao código gerado por IA. Desenho original: `.rascunho/FLUXO-REVISAO-CODIGO.md`.

Aprovações (seguir / ajustar / parar): 1-2, 3, 4-8, 9 e 10.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Contexto | O que a mudança deveria fazer? | `revisao.md` (alvo, base, commit revisado, pedido, critérios de aceite); `alegacoes.md` | Pedido e critérios escritos **antes** de ler o código; origem do pedido citada; o que não se sabe marcado `[A ESCLARECER]`; descrição do autor guardada sem análise | Opus |
| 2 | Tamanho e escopo | A mudança é revisável? | `revisao.md` (tamanho, assuntos, **Contexto aprovado**) | Linhas e arquivos contados sem gerados e lockfiles; assuntos listados; divisão pedida ou dispensada pelo usuário | Opus |
| 3 | Verificação automática | O que as máquinas já checam? | `revisao.md` (tabela de checagens, **Checagens**) | Build, suíte, lint e varredura com situação registrada (OK, FALHOU, NÃO EXECUTADO, PULADO com motivo); vermelho decide atalho para o retorno | Sonnet |
| 4 | Correção | Faz o que foi pedido, inclusive nos casos difíceis? | `achados.md` (origem `code-review`, `verificador`: limites e alegações) | Cada critério de aceite exercitado; caminhos limite percorridos; alegações do autor conferidas | Sonnet |
| 5 | Testes | Os testes provam alguma coisa? | `validation.md` do `verificador`; `achados.md` | Critérios rastreados até a asserção; mutações mortas; nenhum teste apagado, pulado ou enfraquecido sem motivo aceito | Sonnet |
| 6 | Segurança e dados | Abre alguma porta? | `seguranca.md` (se despachado); `achados.md` | Superfície sensível revisada pelo `auditor-seguranca` ou dispensa com motivo; armadilhas da lista conferidas | Sonnet (agente em Opus) |
| 7 | Design e consistência | Combina com o projeto? | `achados.md` | Convenções, camadas e peças existentes conferidas com evidência | Sonnet |
| 8 | Armadilhas de IA | O que a IA costuma errar? | `achados.md` (**Análise**: concluída) | Lista de armadilhas percorrida; cada achado conferido no código e classificado | Sonnet |
| 9 | Retorno | O autor sabe o que fazer? | `retorno.md` (**Retorno entregue**) | Bloqueantes, sugestões e perguntas separados, cada um com local, porquê e caminho; pontos positivos; entregue da forma escolhida | Sonnet |
| 10 | Decisão e reteste | Pode entrar? | `decisao.md` (**Decisão**, rodadas) | Decisão do usuário registrada; ao aprovar, descrição e documentação conferidas; ao pedir mudanças, reteste só do que mudou | Sonnet |

## Modos

| Modo | Fases | Quando |
|---|---|---|
| `completo` | 1 a 10 | PR ou branch de pessoa ou IA, pedido direto do usuário |
| `curto` | 1-2 como confirmação, 3 (dispensável se o chamador acabou de rodar a suíte), 4 a 8; devolve após `análise` | chamado por outro fluxo que decide sozinho o que fazer com os achados |

## Entrada por outro fluxo

| Chamador | Em que fase dele | Alvo | Fases | Devolver após |
|---|---|---|---|---|
| 27 Avaliação de terceiros | qualidade do projeto candidato | **cópia local** do repositório do terceiro; sem diff: um recorte (caminhos centrais) revisado como se fosse uma mudança inteira, com o README e a documentação como "pedido" | 1-2, 3 (rodar só com confirmação: é código de fora; no ambiente isolado e com os comandos de `.specs/avaliacoes/<slug>/execucao.md`, nunca com o `testes.json` do usuário), 4, 5, 7, 8 (a 6 fica com a `auditoria-seguranca`, que o 27 chama à parte). Contrato em `avaliar-terceiros/references/composicao.md` | `análise` |
| 3 Feature, 4 Legado, 12 Bug (proposta, ver `DECISOES.md`) | verificação, depois do PASS do `verificador` | diff da branch contra a base; pedido = `spec.md` ou `relato.md` | 4, 7, 8 (a 5 já foi feita pelo `verificador` do fluxo; a 6 o fluxo despacha à parte) | `análise` |

O chamador grava `revisao.md` (formato de `admissao.md`) e aciona esta skill; as fases 1-2 viram uma confirmação. Bloqueante devolvido vira tarefa no chamador (feature: volta à fase 5; bug: à fase 6; terceiros: condição ou motivo de recusa).

## Laços comuns

- Pedido inexistente ou vago → pergunte ao usuário (via `AskUserQuestion`) o que a mudança deveria fazer; sem pedido, revisa-se só correção técnica, e o retorno diz isso.
- Diff grande demais ou misturando assuntos → pedir divisão é o recomendado; revisar assim mesmo exige aceite do usuário e fica anotado ("revisão de diff gigante vira carimbo").
- Checagem vermelha → retorno curto ao autor (fase 9) com a falha; a análise espera a correção.
- Ferramenta ou comando ausente → `NÃO EXECUTADO` com motivo, nunca em silêncio.
- Achado de agente sem evidência que a sessão confirme → descartado, com nota.
- Mudanças pedidas → nova rodada no reteste, só com o que mudou; 3 rodadas sem fechar os bloqueantes → escala ao usuário (conversa com o autor, dividir ou recusar).
- Bug anterior à mudança → fora da revisão; oferecer a skill `bug`.
