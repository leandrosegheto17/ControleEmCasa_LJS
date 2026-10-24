# Atribuição

A skill `solicitacao` é própria, escrita a partir do desenho em `.rascunho/FLUXO-SOLICITACAO-FEATURE.md`, construída por cima da skill `demandas` (registro único, comum aos fluxos 10, 11 e 32), irmã da skill `sugestao` na forma e na orquestração, e dos fluxos de destino (`feature`, `legado`, `bug` e os demais do mapa da `demandas`). Confirmação por escrito, acordo com versões, marcos de acompanhamento, aviso de desvio e aceite por demonstração são conhecimento comum de gestão de projeto, escritos sem cópia de fonte. Dois trechos foram adaptados (traduzidos, enxutos e generalizados) das fontes abaixo.

## tech-leads-club/agent-skills — `tlc-prd`

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5`
- Arquivos: `packages/skills-catalog/skills/(development)/tlc-prd/SKILL.md` e `references/document-format.md`
- Usado em: `esclarecimento.md` (fase 2: situação do pedido com quem já decidiu, sem reabrir *se* fazer; delimitar a rodada; uma ou duas perguntas por vez, cada uma com a resposta recomendada; não aceitar abstração e empurrar até número ou nome; dizer qual número mudaria a decisão antes de buscá-lo e tratar número ausente como achado; tipos dor, ausência e construção com perguntas próprias; jornada com estados vazio, primeira vez, nova tentativa, pela metade, expirado, sem permissão e abandono, como estados de produto sem como construir; alto impacto com pouca clareza fica em aberto) e `acordo.md` (fase 4: "mais barato que construir" considerado uma vez antes das opções, e nunca oferecer uma opção que não se entregaria). Mudanças: sem o arquivo `.prd/` próprio nem o veredito de construir ou não (a solicitação chega decidida; recusa e renegociação são das fases 4 e 5); a tabela de jornada virou os critérios `CA-NN` em Dado/Quando/Então, confirmados por escrito pelo solicitante; a seção de sucesso não foi usada.
- Licença: CC-BY-4.0 (declarada no frontmatter da skill), autor Tech Leads Club (github.com/tech-leads-club); repositório sob MIT. Texto traduzido e modificado.

## BMAD-METHOD — `ticket-template`

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivo: `skills/bmad-agent-po/assets/ticket-template.md`
- Usado em: `esclarecimento.md`, critérios de aceite (critério numerado com nome do comportamento em Dado/Quando/Então/E; o critério enuncia uma regra, não um exemplo, com o caminho de falha; "não pode mudar" para o comportamento vizinho). Mudanças: sem frontmatter, hierarquia de iniciativa, épico e história, nem espelhamento em ferramenta externa.
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## Inspiração (sem trecho copiado)

- Extensão **SpecKit Grill Me** (https://github.com/yoshi1220/speckit-grill-me, MIT; listada no catálogo de comunidade do spec-kit, clone `.speckit` no commit `27d14e20c187c1f2916540ea201ecbdc9f8ed588`; só o README consultado, sem clone): investigar os fatos do projeto antes de perguntar, rodadas por dependência e continuar até não restar ambiguidade relevante, terminando com a satisfação explícita de quem pediu. Na fase 2, virou "fatos se procuram", as rodadas e a confirmação por escrito.

## Legado (`.claude_legado`, material do usuário)

- `skills/requirement-elicitation/SKILL.md`: em `esclarecimento.md`, todo comportamento com o caso de exceção perguntado ("o que acontece se falhar ou for inválido?"), regra de negócio implícita registrada à parte (regra, motivo, exceção), requisito de qualidade sem número marcado "a confirmar" e nunca inventado, ambiguidade de detalhe registrada e a de escopo levada a quem decide.
- `skills/effort-estimation/SKILL.md`: em `acordo.md`, estimativa por parte com a complexidade que justifica o número, soma comparada com a capacidade conhecida ou marcada "não informada" (sem inventar a comparação), risco de prazo nomeando a parte e o volume, e tarefa incerta virando spike com prazo próprio em vez de estimativa.

Origem citada; sem licença de terceiro.

## Peças acionadas, não copiadas

Skills `demandas` (registrar, procurar, situação, avisar, encaminhar, conferir ligações, contato), `sugestao` (eixos comerciais da `avaliacao.md`, citados), `inventario`, `spike`, `liberacao`, `implantacao` e os destinos (`feature`, `legado`, `bug`, `redesign`, `integracao-terceiros`, `performance`, `automacao`, `documentar`, `incidente`, `projeto-novo`), com o Specify do `tlc-spec-driven` dentro de `feature` e `legado`; agentes `leitor-codigo` e `pesquisador`; superpowers `verification-before-completion`.
