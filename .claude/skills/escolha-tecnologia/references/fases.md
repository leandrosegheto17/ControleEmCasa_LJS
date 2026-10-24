# As 9 fases da escolha de tecnologia

Princípio: **decidir por critérios explícitos e registrar o porquê.** Desenho original: `.rascunho/FLUXO-ESCOLHA-TECNOLOGIA.md`.

As fases andam em blocos, cada um com uma aprovação (seguir / ajustar / parar). Modo rigoroso: 1-2, 3-5, 6, 7-8 e 9. Modo enxuto: 1-2, 3-5 e 7-9 (sem a 6).

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Decisão a tomar | O que exatamente estou escolhendo e por quê? | `escolha.md` (decisão, restrições, reversibilidade, modo) | Uma decisão só, com o que ela afeta e o que fica fora; reversibilidade com motivo; modo sugerido | Opus |
| 2 | Critérios | O que importa nessa escolha? | `escolha.md` (critérios, **Critérios aprovados**: sim) | Eliminatórios verificáveis; desejáveis com peso; tudo escrito **antes** de citar opções | Opus |
| 3 | Opções | Quais são as alternativas reais? | `avaliacao.md` (lista curta) | 3 a 5 (enxuto: 2 a 3) de fontes confiáveis, com "não fazer nada" e "construir" quando couberem; lista confirmada pelo usuário | Opus (pesquisa no `pesquisador`) |
| 4 | Eliminação | Quais não servem? | `avaliacao.md` (eliminadas com motivo e fonte) | Cada eliminada falha num eliminatório com evidência; 2 ou 3 finalistas | Opus |
| 5 | Avaliação | Como cada uma se sai? | `avaliacao.md` (tabela comparativa, **Finalistas**) | Nota por critério com evidência (fonte primária e data da consulta) ou `PREMISSA`; custo total; pontos incertos listados | Opus |
| 6 | Teste prático | Funciona no meu caso? | `.specs/spikes/<pergunta>-<finalista>/registro.md` por finalista; `avaliacao.md` (**Teste prático**) | Mesmo critério e prazo para todos os finalistas; veredito e confiança de cada um na tabela; ou dispensa com motivo | Sonnet (skill `spike`) |
| 7 | Riscos e saída | E se der errado? | `avaliacao.md` (riscos e saída por finalista) | Dependência, custo de migrar, projeto morrer, plano B; risco de reverter aceito ou não | Opus |
| 8 | Decisão | Qual escolho? | `escolha.md` (**Decisão**), justificativa em `avaliacao.md` | Escolha do usuário, justificada em poucas linhas; condição em que mudaria | Opus |
| 9 | Registro (ADR) | Como o futuro entende essa escolha? | ADR no repositório; `AD-NNN` no `STATE.md` (rigoroso); `escolha.md` (**Registro**) | Contexto, opções, decisão, consequências (inclusive negativas) e quando revisar; escolha levada ao **Usar em** | Sonnet |

## Entrada por outro fluxo

| Chamador | Em que fase dele | O que ele grava em `escolha.md` | Usar em |
|---|---|---|---|
| 1 Projeto novo | 7 Desenho (`tlc-spec-driven`, Design), decisão de stack difícil de reverter | decisão (ex.: banco, linguagem), restrições de `viabilidade-tecnica.md` (stack candidata, custo, volume) e da spec | tabela de decisões técnicas do `design.md` da feature, referenciando o `AD-NNN` |
| 6 Integração | 2 Escolha do serviço | capacidade a integrar, volume, criticidade, LGPD, orçamento, reversibilidade sugerida e critérios sugeridos (contrato em `integracao-terceiros/references/composicao.md`) | campos **Fornecedor** e **Rota de saída** de `.specs/integracoes/<slug>/terceiro.md` |
| 30 Automação | 4 Ferramenta, quando há alternativas reais | escopo do processo, degraus da escada que restaram, onde roda, custo aceitável, reversibilidade sugerida (enxuto na maioria) e critérios sugeridos (contrato em `automacao/references/composicao.md`) | campos **Ferramenta**, **Onde mora** e **Como se testa** de `.specs/automacoes/<slug>/processo.md` |

O chamador grava `escolha.md` com o que tem e aciona esta skill; as fases 1-2 completam o que falta e pedem uma confirmação (modo e critérios são sempre do usuário). A skill segue até a fase 9 e devolve ao chamador a opção escolhida, o caminho do ADR e o `AD-NNN`. Chamada pelo Design do `tlc-spec-driven`, a entrada `AD-NNN` já fica gravada aqui: o Design só a referencia, sem criar outra.

## Laços comuns

- Só uma opção real (as outras são de palha, ou uma restrição já decide) → não há escolha: registre o motivo num ADR leve (se a decisão for relevante) e encerre.
- Não é escolha, é dúvida concreta que só testando se sabe → skill `spike`. A documentação responde → `pesquisador`.
- Critério vago ("ser bom", "escalar") → refaça até ser verificável ("até 200 ms com 1.000 registros", "licença permite uso comercial").
- Opção favorita citada antes dos critérios → anote, mas escreva os critérios sem olhar para ela; se um critério só existe para favorecê-la, retire.
- Nenhuma opção passa nos eliminatórios → volte aos critérios (afrouxar um eliminatório é decisão do usuário, com motivo registrado), considere "construir" ou "não fazer nada", ou pare.
- Empate na tabela → a mais simples e a mais reversível; depois, a mais madura e conhecida pela equipe.
- Spike de um finalista estourou o prazo ou ficou inconclusivo → isso é dado ("mais difícil do que parecia"), não motivo para estender só aquele; a comparação segue com o que há.
- Decisão revelou-se mais difícil de reverter do que parecia → passe ao modo rigoroso, aproveitando o que foi feito.
- Escolha antiga sendo trocada → ADR novo que substitui o antigo (o antigo muda só a linha de situação) e `AD-NNN` novo que substitui o anterior.
