# As 9 fases da feature em legado

Princípio: **como mexer sem entender tudo e sem quebrar o que funciona há anos?**

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Pedido | O que a feature faz e como saberei que está pronta? | `spec.md` | Critérios de aceite testáveis; `validate_spec.py` sem erro | Opus |
| 2 | Arqueologia | Como essa parte funciona de fato? | `inventario.md`, `reconhecimento.md`, `arqueologia.md` | Ambiente roda (ou tarefa para fazê-lo rodar); comportamento e histórico registrados | Opus (leitura em Haiku) |
| 3 | Fronteira e risco | Onde posso mexer com segurança? | `arqueologia.md` (costuras, raio de impacto, staging, flag) | Ponto único de integração escolhido; impacto aceito ou escalado | Opus |
| 4 | Rede de proteção | Como saberei se quebrei algo? | `protecao.md`, commit de caracterização | Comportamento do raio de impacto caracterizado e verde | Sonnet |
| 5 | Plano | Qual o menor desvio possível? | `design.md`/`tasks.md` | Código novo ao lado do antigo, ponto único, flag quando possível, plano de volta | Opus |
| 6 | Implementação | A feature funciona sem alterar o que existe? | código, testes, commits na branch | Gates verdes; caracterização intacta | Sonnet |
| 7 | Verificação | Funciona e não houve regressão? | `validation.md` (PASS), revisão do diff, `seguranca.md` se aplicável | PASS, sem bloqueio, fluxos vizinhos testados | Sonnet |
| 8 | Liberação cuidadosa | Como coloco no ar com reversão fácil? | entrada em `.specs/liberacao.md` | Suíte verde; no ar com flag ou gradual; reversão testada | Sonnet |
| 9 | Registro | O próximo a mexer aqui vai sofrer menos? | contexto do projeto, `inventario.md` e `integracao.md` atualizados | Armadilhas e costuras documentadas | Sonnet |

## Laços comuns

- Ambiente não roda → primeira tarefa é fazê-lo rodar; sem isso não há fase 4.
- Impacto alto demais → refatorar antes (skill `refatoracao`; depois, arqueologia refeita), serviço novo ao lado (estrangular aos poucos), reduzir escopo ou seguir com risco registrado.
- Teste de caracterização quebrou → a feature mudou comportamento existente: decisão do usuário (ajustar a feature ou aceitar a mudança, registrando).
- Monitoramento acusou problema na liberação → reverter, corrigir na fase 6.
