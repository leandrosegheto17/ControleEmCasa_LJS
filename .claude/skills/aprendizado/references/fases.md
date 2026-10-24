# As 8 fases do projeto de aprendizado

Princípio: **o objetivo é o que se aprende; o código é meio e pode ser descartado.** Desenho original: `.rascunho/FLUXO-APRENDIZADO.md`.

As fases andam em cinco blocos, cada um com uma aprovação (seguir / ajustar / parar): 1-2, 3-4, 5, 6 e 7-8. Na fase 5, cada fatia fecha com uma pergunta de próximo passo (seção da fatia em `tutoria.md`); a aprovação da fase vem quando a última fatia fecha.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Objetivo de aprendizado | O que quero ser capaz de fazer ao final? | `plano.md` (objetivos `O-1` a `O-3`, prazo) | 1 a 3 objetivos com verbo observável e **como vou provar**; prazo com data, curto | Opus |
| 2 | Ponto de partida | O que já sei e o que falta? | `plano.md` (ponto de partida, **Objetivos aprovados**: sim) | O que conhece, o que é novo e o maior risco de não entender, ligados aos objetivos | Opus |
| 3 | Fontes | Onde estudar? | `plano.md` (fontes com data e versão) | Poucas fontes: documentação oficial, um tutorial ou curso, um projeto de referência; cada uma ligada a um objetivo | Opus (agente `pesquisador` em Sonnet) |
| 4 | Projeto-veículo | Que projeto pequeno exercita os objetivos? | `plano.md` (veículo, fatias, fora do objetivo, **Onde mora o código**, **Plano aprovado**: sim) | Escopo mínimo que cobre todos os objetivos, com graça para o usuário; 3 a 6 fatias pequenas; pasta fora de qualquer projeto sério | Opus |
| 5 | Construção guiada | Estou entendendo ou só copiando? | código do usuário na pasta do veículo; `diario.md` | Cada fatia funciona **e** o usuário a explicou com as próprias palavras; ajuda e código mostrado registrados | Sonnet (Opus por fatia difícil) |
| 6 | Verificação | Aprendi de verdade? | `verificacao.md` (**Resultado**) | Uma parte refeita sem consulta; explicação como se ensinasse; cada objetivo avaliado com evidência | Opus |
| 7 | Registro | Como guardo o aprendizado? | `notas.md` | O que aprendi por objetivo, armadilhas, trechos reutilizáveis escritos pelo usuário, links com data | Sonnet |
| 8 | Decisão final | O que faço com o projeto? | `notas.md` (**Destino**) | Arquivado, aprofundamento aberto, base aberta em outro fluxo (sem copiar código) ou descartado com confirmação | Sonnet |

## Por que Sonnet na fase 5

A tutoria é a conversa mais longa do fluxo, e o conteúdo é tecnologia documentada, que o Sonnet explica bem. O julgamento fino fica nas fases que decidem: objetivos e escopo (1-4) e a avaliação contra os objetivos (6), em Opus. Uma fatia em que a explicação não assenta depois de duas tentativas, ou de conceito profundo, pode subir para Opus só enquanto durar.

## Laços comuns

- É só uma dúvida técnica pontual → agente `pesquisador` (a documentação responde) ou skill `spike` (só testando se sabe); encerre com **Destino** `não era estudo`.
- Objetivo vago ("aprender React") → reescrever até ter verbo observável e prova ("montar uma lista com filtro e estado compartilhado entre dois componentes, sem consulta").
- Mais de 3 objetivos → escolher os 3 que valem o prazo; os outros vão para "Depois".
- Veículo grande demais (mais de 6 fatias, ou fatias que não cabem numa sessão) → cortar até caber no prazo; ideia nova no meio vai para "Depois".
- Usuário quer o código pronto o tempo todo → lembrar o objetivo uma vez e oferecer: seguir como estudo, ou trocar de fluxo (o que ele quer é construir: `uso-proprio`, `projeto-novo`, `feature`).
- Prazo vencido ou objetivo já atingido → verificação com o que há (extensão no máximo uma vez).
- Verificação com objetivo parcial → uma fatia de reforço na fase 5 (ajustar) ou lacuna registrada em `notas.md` e aprofundamento na fase 8.
- O veículo "ficou bom e vou usar" → é a armadilha do código de estudo virar produto: na fase 8, **aproveitar como base** reescreve com testes por outro fluxo.
