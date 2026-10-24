# As 9 fases da integração com terceiros

Princípio: **tratar o serviço externo como componente que vai falhar** e isolá-lo do resto do sistema. Desenho original: `.rascunho/FLUXO-INTEGRACAO.md`.

Integrar é uma feature com cuidados extras. Por isso as fases 1 a 4 (antes do código) e 9 (depois) são desta skill, e as fases 5 a 8 andam **por dentro da skill `feature` ou `legado`**, que já fazem spec, reconhecimento, plano, rede de proteção, execução, verificação e integração da branch. Esta skill acrescenta o que é próprio de terceiro (contrato de [composicao.md](composicao.md)).

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Necessidade | Por que integrar e o que se espera obter? | `terceiro.md` (caso de uso, dados, volume, criticidade, orçamento, **Fases**) | Caso de uso e resultado esperado escritos; dados trocados e volume com número ou faixa; o que acontece se o serviço cair; "integrar é o caminho" respondido | Opus |
| 2 | Escolha do serviço | Qual fornecedor, a que custo e risco? | `.specs/escolhas/<slug>/` (ADR); **Fornecedor** e **Rota de saída** em `terceiro.md` | Escolha do usuário com custo no volume, limites, SLA, termos e rota de saída com fonte e data; ou dispensa com motivo e rota de saída anotada | Opus (skill `escolha-tecnologia`) |
| 3 | Contrato | Como o serviço se comporta de fato? | `contrato.md`; `.specs/spikes/<slug>-contrato/` se houve sandbox | Autenticação, operações, erros, limites, paginação, versão e webhooks mapeados com fonte e data; itens críticos confirmados no sandbox ou marcados `não testável` com o risco; divergências registradas | Sonnet (pesquisa no `pesquisador`, sandbox pela skill `spike`) |
| 4 | Segurança e legal | Que dados saem e quem responde por eles? | `seguranca-legal.md` | Dados que saem campo a campo e minimizados; base legal, papéis, transferência internacional e contrato com resposta ou `[A ESCLARECER]`; fatos legais conferidos ou `PREMISSA`; segredos e permissões definidos; risco aceito pelo usuário | Opus |
| 5 | Desenho | Como isolar o terceiro do resto? | `.specs/features/integracao-<slug>/spec.md`, `reconhecimento.md` (ou `arqueologia.md`), `design.md`/`tasks.md` | Spec com os critérios de falha; plano com adaptador, tempo limite, nova tentativa, disjuntor, idempotência, fila, degradação e desligamento; toda tarefa com teste | Opus (skill `feature`/`legado`) |
| 6 | Implementação | Funciona contra o simulado e contra as falhas? | código, testes, `protecao.md`, um commit por tarefa | Gate de cada tarefa verde; testes de falha, de lentidão e de contrato passando; suíte padrão sem rede | Sonnet |
| 7 | Verificação | Funciona de verdade e sem vazar nada? | `validation.md` (PASS) e revisão curta da feature; `.specs/seguranca/<data>-integracao-<slug>/`; `verificacao.md` | PASS; revisão sem bloqueio; sem crítico ou alto aberto; ponta a ponta no sandbox feito (ou dispensado com motivo); segredos e logs limpos; custo estimado e limite configurado | Sonnet |
| 8 | Liberação | Como ligo sem risco? | `integracao.md` da feature; entrada em `.specs/liberacao.md` | Branch integrada; chaves de produção no cofre; flag com desligamento testado; liberação gradual concluída ou parada pelo critério | Sonnet (skill `liberacao`) |
| 9 | Monitoramento | Percebo quando o terceiro falha ou muda? | `monitoramento.md`; `.specs/runbook.md` | Métricas e alertas ativos com disparo testado; acompanhamento de mudanças com dono; rotação de chaves com data; **Resultado** `concluída` | Sonnet |

## Mapa das fases 5 a 8 na skill `feature` ou `legado`

| Integração | `feature` (fluxo 3) | `legado` (fluxo 4) |
|---|---|---|
| 5 Desenho | 1 Pedido, 2 Reconhecimento, 3 Plano | 1 Pedido, 2-3 Arqueologia, 4 Rede de proteção, 5 Plano |
| 6 Implementação | 4 Rede de proteção, 5 Implementação | 6 Implementação |
| 7 Verificação | 6 Verificação | 7 Verificação |
| 8 Liberação | 7 Integração, depois skill `liberacao` | 8 Liberação (já chama a `liberacao`) e 9 Registro |

Qual das duas: pergunte no início da fase 5 via `AskUserQuestion`, recomendando pelo projeto (código antigo, pouco testado, autores ausentes → `legado`; senão `feature`). No `legado`, a rede de proteção entra antes do plano: a fase 5 da integração inclui a 4 dele.

## Aprovações

Uma por fase (seguir / ajustar / parar). Nas fases 2, 3, 5 a 8, as skills chamadas pedem as aprovações delas; ao voltar, a integração confere os itens próprios (lista em [composicao.md](composicao.md)) e pede a dela sobre o resumo.

## Laços comuns

- Contrato real diverge muito da documentação, limite ou custo inviável, risco legal alto → saída de emergência: volta à fase 2 (`SKILL.md`). A escolha nova gera ADR que substitui o anterior.
- Fornecedor não tem sandbox → contrato só por documentação, itens críticos `não testável`; a fase 7 faz o ponta a ponta com conta de produção em modo de teste (se houver) ou com a menor operação real possível, ambos com confirmação específica; o risco entra no plano de liberação (alcance inicial menor).
- Sandbox se comporta diferente de produção (comum em pagamento) → anote em `contrato.md`; a liberação começa com alcance mínimo e reconciliação manual.
- Teste falha de forma inesperada → `systematic-debugging`, na tarefa da feature.
- Verificador FAIL, revisão com bloqueio ou achado crítico ou alto da auditoria → tarefa de correção, volta à fase 6 (até 3 rodadas; depois, escala ao usuário).
- Fornecedor anuncia mudança ou fim de versão depois de pronta → registre em `monitoramento.md` e abra uma integração nova `<slug>-<versão>` com as fases 1 e 2 `dispensada — mesma necessidade e fornecedor de <slug>`, começando no contrato: `contrato.md` e os testes de contrato mudam antes do código.
- Segunda capacidade do mesmo fornecedor → integração nova, reaproveitando `contrato.md` e `seguranca-legal.md` como ponto de partida, e o adaptador existente (o reconhecimento decide estender).
