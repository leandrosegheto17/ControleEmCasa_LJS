# Atribuição

A skill `aprendizado` é própria, escrita a partir do desenho em `.rascunho/FLUXO-APRENDIZADO.md`. Os exercícios da tutoria foram adaptados (traduzidos e enxugados) da fonte abaixo.

## Learning Opportunities (Chris Hicks; modificada por Felipe Rodrigues)

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5`
- Arquivos: `packages/skills-catalog/skills/(learning)/learning-opportunities/SKILL.md` e `references/PRINCIPLES.md`
- Autoria: Chris Hicks (https://www.fightforthehuman.com), modificada por Felipe Rodrigues (github.com/felipfr), versão 1.1.0.
- Usado em: `tutoria.md` (regra "pergunte e pare", correção direta da resposta errada, tipos de exercício prever e observar, gerar e comparar, ensinar de volta, perguntas de por quê, transferência e análise de erro, mandar ao arquivo em vez de mostrar trecho com indicações cada vez mais vagas, anti-padrões, ilusão de fluência e recordação no início da sessão) e `verificacao.md` (tipos de pergunta).
- Licença: **Creative Commons Attribution 4.0 (CC-BY-4.0)**, declarada no frontmatter da skill, https://creativecommons.org/licenses/by/4.0/. O repositório como um todo é MIT, mas vale a licença declarada no arquivo. Alterações: tradução para o português, redução, troca do formato de oferta opcional (10-15 minutos, no máximo 2 por sessão) pelo ciclo obrigatório de cada fatia, comparação com a documentação oficial em vez do código da IA, e perguntas pela caixa de `AskUserQuestion`.

## Só referência, nada copiado

- **`learning-output-style`** (plugins oficiais da Anthropic, https://github.com/anthropics/claude-plugins-official, commit `465f09344424225c25d438f2e052732c3d688d2f`, Apache 2.0): a ideia de deixar pronto só o que não tem escolha relevante (configuração, código repetitivo) inspirou o **andaime** fora do objetivo. Aqui, ao contrário do plugin, a sessão não escreve a lógica e o usuário escreve tudo o que é objetivo. Plugin não instalado.
- **`brainstorming`** (superpowers, https://github.com/obra/superpowers, MIT): postura de uma pergunta por vez, opções quando possível e escopo enxuto (YAGNI). Não é acionado.
- **Bloom** (https://github.com/Li-Evan/Bloom) e **learn-faster-kit** (https://github.com/hluaguo/learn-faster-kit): só ponteiros da lista `.awesome`, cuja licença não permite adaptar. Nada foi lido para copiar nem copiado.

## Peças acionadas, não copiadas

Agente `pesquisador`, skills `spike` (regra de promoção), `uso-proprio`, `projeto-novo` e `feature` (destino "aproveitar como base"), `verification-before-completion` (superpowers, MIT).
