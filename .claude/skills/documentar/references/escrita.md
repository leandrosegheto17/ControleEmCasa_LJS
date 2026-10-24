# Regras de escrita (fases 3 a 8)

Valem para todo documento que o fluxo escreve no repositório do projeto.

## Fonte de cada afirmação

- **Artefato de trabalho** (`.specs/documentacao/<slug>/*.md`): toda afirmação tem fonte completa: `arquivo:linha`, ou o comando executado com o resultado observado (código de saída, trecho curto da saída, data). É ali que a verificação acontece.
- **Documento do projeto** (README, `docs/`): cita o **caminho** do arquivo quando o leitor precisa ir até ele (linha muda a cada commit; só use linha em `CLAUDE.md`/`AGENTS.md` se for estável). Todo comando escrito ali foi executado na fase 3, 5 ou 9.
- **Marcação do que não foi verificado**, no próprio texto, para o leitor ver:
  - `> **Não verificado:** <afirmação> — lido em <arquivo>, não executado.` (leu o código, não rodou)
  - `> **Premissa:** <afirmação> — <de quem ou de onde veio>.` (veio de pessoa ou documento antigo, sem confirmação)
  - `[A ESCLARECER: <pergunta>]` (ninguém sabe; vira pergunta ao usuário na aprovação da fase)
- Nunca transforme "não verificado" em certeza por estilo de escrita. Se a fase 9 confirmar, a marca sai.

## O porquê

O quê o código mostra; o **porquê** se perde. Quando aparecer (mensagem de commit, PR, comentário, resposta do usuário), registre em uma linha com a fonte (`commit <hash>`, "segundo <pessoa>"). Porquê deduzido sem fonte é `Premissa`.

## Curto e específico

- Escreva para o público de `documentacao.md`: o novo dev quer rodar e achar onde mexer; o cliente quer usar; a IA quer comandos e proibições.
- Não transcreva o que o manifesto, a configuração ou o código dizem melhor (lista de dependências, todos os scripts, árvore de pastas inteira): aponte para o arquivo e escreva só a ressalva que ele não diz ("`npm test` não roda os testes de integração; use `npm run test:int` com o banco no ar").
- Um assunto, um lugar: documentos se apontam em vez de repetir.
- Prefira tabela e lista curta a parágrafo. Exemplo real do projeto vence explicação genérica.

## Nada de segredo

Nunca copie token, senha, chave, string de conexão com credencial ou dado pessoal real, nem em exemplo. Escreva onde o valor fica ("variável `DATABASE_URL`, pedir a <responsável>; modelo em `.env.example`") e use valores fictícios óbvios. Repositório público: nada de endereço interno, nome de cliente ou detalhe de vulnerabilidade não corrigida (fica em `riscos.md`).

## Documento existente é a base

Quem escreveu pagou por aquilo, em geral depois de ver algo dar errado. Antes de mudar um documento existente, dê a cada trecho um destino, com motivo:

| Destino | Quando |
|---|---|
| manter | verdadeiro e útil para o público |
| reescrever | verdadeiro, mas confuso, longo ou fora do lugar; a regra inteira continua |
| mover | pertence a outro documento (um aponta para o outro) |
| automatizar | uma checagem (lint, CI, hook) garante melhor; a linha fica até a checagem existir |
| apagar | **só** com um destes motivos: (1) falso ou desatualizado, com a evidência; (2) já garantido por checagem automática; (3) contradiz outra instrução e perde; (4) o usuário aprovou apagar aquele trecho |

"Dá para descobrir lendo o código" não é motivo para apagar. Reescrita que perde parte da regra conta como apagar a parte perdida. Mostre o diff e a lista de destinos na aprovação da fase.

## Antes de gravar

- Caminhos citados existem; links internos abrem (relativos, conferidos com `ls`).
- Comandos foram executados (fase 3, 5 ou 9) e estão iguais ao que rodou.
- Diagrama renderiza (sintaxe Mermaid válida; na dúvida, `flowchart`).
- Grave na branch `docs/<slug>`; commits `docs: <o quê>` ao fim de cada fase aprovada.
