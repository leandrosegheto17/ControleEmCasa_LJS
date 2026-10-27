# As 12 fases do projeto novo

Princípio: **reduzir incerteza o mais barato possível antes de gastar com construção**. Não é uma cascata: é um funil com laços. Toda fase pode terminar em "parar", e isso é um resultado válido.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo da sessão |
|---|---|---|---|---|---|
| 1 | Ideia | Qual problema, para quem, e por que agora? | `ideia.md` | A ideia está registrada com hipóteses e dúvidas; vale investigar | Opus |
| 2 | Discovery | O problema é real e dói o bastante? | `pesquisa.md`, `problema.md` | Problema confirmado por evidência, com métricas e custo de não fazer nada | Opus |
| 3 | Solução e valor | Qual a menor solução que alguém usaria ou pagaria? | `solucao.md` | Há uma opção recomendada (ou a recomendação é não seguir) | Opus |
| 4 | Viabilidade técnica | Dá para construir, com que risco? | `viabilidade-tecnica.md` | Veredito viável ou viável com riscos mitigados | Opus |
| 5 | Viabilidade de negócio (opcional) | Os números fecham? | `plano-comercial.md` | Veredito explícito; se não fecha, o usuário decide seguir ou não | Opus |
| — | Decisão | Seguir, esclarecer ou matar? | `decisao.md` | Veredito `seguir` com entrada do MVP | Opus |
| 6 | Definição do MVP | O que entra, o que fica de fora, como saber se deu certo? | `features/<mvp>/spec.md` | Spec aprovada e aceita pelo `validate_spec.py` | Opus |
| 6b | Roteiro (só se o escopo não cabe em uma feature) | Quais features, em que ordem e de que tamanho? | `.specs/projeto/roadmap.md`, decisão `AD-NNN` em `STATE.md` | Features fatiadas na vertical, com ordem e requisitos aprovados; só a primeira segue para o Desenho | Opus |
| 7 | Desenho | Como será estruturado e como vai parecer? | `design.md`; com interface, `.specs/mockup/` (direção, `tokens.css`, guia, 2 a 3 telas-chave) | Arquitetura e decisões aprovadas; com interface, guia de estilo e telas-chave aprovados na galeria | Opus |
| 8 | Preparação | Como vamos trabalhar? | `tasks.md`; repositório, ambiente, esqueleto, CI (com checagem de tokens, se houver interface) | Tarefas aprovadas e aceitas pelo `validate_tasks.py`; esqueleto rodando | Sonnet |
| 9 | Construção | Cada fatia entrega valor? | código, testes, um commit por tarefa | Todas as tarefas concluídas com o gate passando | Sonnet (trabalhadores por lote) |
| 10 | Validação | Está correto, seguro, utilizável e com a aparência aprovada? | `validation.md` (PASS), `seguranca.md`; com interface, "Mockup × app" na galeria | PASS do verificador, nenhum achado crítico ou alto em aberto e, com interface, aceite visual do usuário | Sonnet |
| 11 | Lançamento | Como colocar no ar com segurança? | entrada em `.specs/liberacao.md` (skill `liberacao`) | Suíte verde, validações de lançamento concluídas, liberação gradual, reversão testada | Sonnet |
| 12 | Operação e aprendizado | A hipótese se confirmou? | (a definir) | Métricas acompanhadas; decisão de persistir, pivotar ou encerrar | Sonnet |

## Laços comuns

- Viabilidade técnica inviável → volta à fase 3 (outra opção de solução).
- Plano comercial não fecha → ajustar preço, canal ou escopo (fases 3 ou 5), ou parar.
- Decisão `esclarecer` → a fase indicada em `decisao.md`.
- Verificador FAIL → correções voltam à fase 9 (até 3 rodadas; depois, escala ao usuário).
- Achado crítico ou alto de segurança → tarefa de correção na fase 9.
- Validação pendente marcada como condição (tabela em `decisao.md`) → bloqueia a entrada na fase 9 (construção) ou 11 (lançamento) até ser concluída, ter a condição mudada pelo usuário ou o projeto parar.
- Diferença visual rejeitada na comparação → tarefa de correção na fase 9. Mudança de aparência desejada → começa no mockup (fase 7), depois vira tarefa.

## Princípios

- Discovery e solução vêm antes de qualquer especificação.
- Protótipos e spikes entram cedo, porque são o jeito mais barato de dissolver incerteza.
- Esqueleto ponta a ponta já na preparação, para o pipeline nunca ser surpresa.
- Construção por fatias que entregam valor, não por camadas técnicas.
- Métricas e critério de parada nascem no MVP.
- Segurança, legal e dados percorrem as fases 4 a 11.
- A fase 12 realimenta a 1.
