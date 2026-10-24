# As 8 fases da prova de conceito (spike)

Princípio: **o produto do spike é a resposta, não o código.** Desenho original: `.rascunho/FLUXO-SPIKE.md`.

As fases andam em quatro blocos, cada um com uma aprovação (seguir / ajustar / parar), porque o spike é curto e cada bloco produz um artefato só.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Pergunta | Que dúvida exata preciso resolver? | `spike.md` (pergunta) | É spike (só testando se sabe); uma pergunta só, com resposta sim/não ou número; quem espera a resposta anotado | Opus |
| 2 | Critério de sucesso | O que eu aceitaria como resposta? | `spike.md` (critério) | "Deu certo", "deu errado" e "inconclusivo" escritos antes do experimento, com limites numéricos quando possível; condições da medição definidas | Opus |
| 3 | Limite de tempo | Quanto vale gastar? | `spike.md` (prazo, **Preparação aprovada**: sim) | Prazo em relógio e em tentativas; onde roda o código; ações externas listadas | Opus |
| 4 | Experimento | O caminho mais curto até a resposta? | código em `.specs/spikes/<slug>/codigo/` (ou worktree `spike/<slug>`) | Experimento rodou até a resposta, até o limite ou até um bloqueio | Sonnet (agente `implementador`) |
| 5 | Observação | O que aconteceu de fato? | `resultado.md` | Medições com o comando que as produziu, conferidas pela sessão; surpresas, obstáculos e esforço real anotados | Sonnet |
| 6 | Conclusão | Qual é a resposta? | `registro.md` (veredito) | Veredito contra o critério congelado; confiança com motivo; explicações concorrentes; o que ficou sem resposta | Opus |
| 7 | Registro | Como guardo o aprendizado? | `registro.md` completo; resposta levada ao **Usar em** | Nota curta com pergunta, método, resultado, conclusão, riscos e links; trechos de referência, se houver | Opus |
| 8 | Descarte ou promoção | E o código? | `registro.md` (**Destino do código**) | Código apagado (ou mantido fora do git com data); promoção aberta no fluxo certo, sem copiar código | Sonnet |

## Entrada por outro fluxo

| Chamador | Em que fase dele | O que ele grava em `spike.md` | Usar em |
|---|---|---|---|
| 1 Projeto novo (`viabilidade-tecnica`) | 4 (incerteza que só testando se sabe) | pergunta, dimensão da incerteza, por que importa | linha da incerteza em `.specs/produto/viabilidade-tecnica.md` |
| 25 Escolha de tecnologia | 6 (teste prático), **um spike por finalista** | pergunta, finalista, critério e prazo **iguais para todos os finalistas** | seção Teste prático de `.specs/escolhas/<slug>/avaliacao.md` |
| 6 Integração | 3 Contrato, no sandbox do fornecedor | pergunta "o sandbox bate com a documentação nos itens C-01 a C-NN?" (ou um número: limite real, latência), itens críticos, ações externas (contrato em `integracao-terceiros/references/composicao.md`) | coluna **Situação** de `.specs/integracoes/<slug>/contrato.md` |

O chamador grava `spike.md` com o que tem e aciona esta skill; a preparação completa o que falta e pede uma confirmação. A skill segue até a fase 8 e devolve ao chamador o caminho de `registro.md`, o veredito e a confiança. Spikes comparativos (fluxo 25): slug `<pergunta>-<finalista>`, critério copiado sem alteração, para que os resultados sejam comparáveis.

## Laços comuns

- Não é spike (a documentação responde) → `pesquisador`; registre em `registro.md` com **Veredito**: `não era spike` e a resposta da pesquisa.
- Não é dúvida técnica, é decisão que ninguém tomou → devolva ao chamador ou ofereça o fluxo 25 (escolha de tecnologia).
- Pergunta com várias dúvidas dentro → quebre em spikes separados.
- Critério vago ("ver se funciona bem") → refazer até ter um resultado que provaria que **não**.
- Experimento bloqueado (sem acesso, conta, credencial) → pare, registre o bloqueio em `resultado.md` e pergunte: resolver o acesso, mudar o método (dentro do mesmo critério) ou concluir como inconclusivo.
- Prazo estourado → conclusão com o que há; extensão no máximo uma vez, por decisão do usuário.
- Resultado inconclusivo → um spike novo só se a pergunta ainda valer a pena, com método diferente; nunca "mais um pouco" no mesmo.
- Código "bom demais para jogar fora" → é a armadilha que este fluxo evita: trechos de referência no `registro.md` e reescrita com testes por outro fluxo.
