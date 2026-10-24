# Desenho e implementação (fases 5 e 6)

Responde: **como isolar o terceiro do resto, e como provar que o sistema aguenta quando ele falha?** Vale por dentro da skill `feature` ou `legado` (contrato em [composicao.md](composicao.md)). A ferramenta concreta (biblioteca de resiliência, simulador HTTP, fila) é a que o projeto já tem, achada no reconhecimento; peça nova só se nenhuma instalada resolver.

## Seções do desenho (fase 5)

O `design.md` (ou o plano inline) responde cada uma, ou marca `não se aplica — <motivo>`:

1. **Adaptador.** Uma interface nossa, no vocabulário do domínio (`Cobrancas.criar(pedido)`, não `stripe.PaymentIntent.create`), e uma implementação por fornecedor atrás dela. Tipos, erros, nomes e o SDK do fornecedor **não passam** do adaptador. Os erros dele são traduzidos para erros nossos: transitório, definitivo, recusado pelo negócio (cartão negado), não autorizado.
2. **Tempo limite** em toda chamada: de conexão e total, com número justificado pela criticidade e pela latência de `contrato.md`. Sem tempo limite, uma lentidão do terceiro vira lentidão do sistema inteiro.
3. **Nova tentativa** só em erro transitório (tempo esgotado, 5xx, 429, conexão recusada) **e** em operação idempotente (ou com chave de idempotência). Recuo exponencial com variação aleatória, respeitando `Retry-After`; máximo de tentativas e tempo total máximo. Erro definitivo (4xx de validação, recusa) nunca se repete.
4. **Disjuntor.** Depois de N falhas seguidas (ou taxa acima de X% numa janela), para de chamar por um tempo e falha rápido; depois deixa passar uma chamada de teste. Os números ficam na configuração.
5. **Limite do nosso lado.** Concorrência máxima de chamadas ao fornecedor e limitador de taxa abaixo do limite dele, para um pico nosso não virar 429 para todos.
6. **Idempotência.** Operação que cria ou cobra leva chave de idempotência estável (derivada do pedido, não aleatória a cada tentativa). Do lado da entrada, evento repetido não é processado duas vezes.
7. **Fila para o que não é crítico.** O que o usuário não precisa esperar (e-mail, sincronização, nota fiscal) vai para uma fila com reprocessamento e fila de mortos. Se a chamada depende de uma gravação no banco, gravar a intenção na mesma transação e enviar depois (caixa de saída), para não perder nem duplicar.
8. **Webhooks recebidos.** Conferir a assinatura, responder rápido e processar em segundo plano; deduplicar pelo identificador do evento; não supor ordem; para dinheiro e acesso, confirmar o estado consultando a API.
9. **Reconciliação.** Evento perdido acontece: uma rotina periódica compara o nosso estado com o do fornecedor e corrige ou alerta.
10. **Degradação elegante.** O que o usuário vê e o que o sistema faz quando o serviço está fora: mensagem clara, operação enfileirada para depois, caminho manual, ou recurso desligado. Decidido pela criticidade de `terceiro.md`.
11. **Desligamento.** Feature flag (ou configuração) que desliga a integração sem deploy, levando ao caminho de degradação. É a reversão da fase 8.
12. **Validação da resposta.** Esquema conferido na entrada do adaptador; campo novo ignorado; campo obrigatório ausente é erro tratado, não exceção solta.
13. **Configuração por ambiente.** URL base, versão fixada da API, chaves (só o nome da variável), tempos e limites fora do código.
14. **Observabilidade.** Cada chamada registra operação, duração, resultado, tentativa e identificador de correlação, **sem** dado pessoal, cartão ou segredo (mascarar). Métricas para a fase 9.
15. **Custo.** Contador de chamadas pagas e teto (diário ou mensal) que alerta e, se o caso pedir, bloqueia.
16. **SDK oficial ou HTTP direto.** SDK mantido e que cobre as operações: usar, atrás do adaptador, com versão fixada. Senão, cliente HTTP do projeto.

## Critérios de falha para a spec (fase 5, Specify)

Adapte ao caso; cada um vira critério de aceite EARS com teste. Exemplos:

- `WHEN o fornecedor não responder em <T> ms THE sistema SHALL encerrar a chamada e <degradação>`
- `WHEN o fornecedor responder 429 com Retry-After THE sistema SHALL esperar o indicado antes de tentar de novo, até <N> tentativas`
- `WHEN o fornecedor responder erro definitivo THE sistema SHALL não repetir a chamada e SHALL <mensagem ou estado>`
- `WHILE o disjuntor estiver aberto THE sistema SHALL falhar sem chamar o fornecedor e SHALL <degradação>`
- `WHEN a mesma operação for enviada duas vezes THE sistema SHALL produzir um único efeito no fornecedor`
- `WHEN um webhook chegar com assinatura inválida ou fora da tolerância de horário THE sistema SHALL rejeitar sem processar`
- `WHEN o mesmo evento de webhook chegar repetido THE sistema SHALL processá-lo uma vez só`
- `WHEN a resposta vier sem campo obrigatório THE sistema SHALL tratar como erro do fornecedor, sem estado parcial`
- `WHEN a integração estiver desligada pela flag THE sistema SHALL <degradação> sem chamar o fornecedor`
- `WHEN o gasto do período atingir <teto> THE sistema SHALL alertar <quem> e <bloquear | seguir>`
- `THE registro de cada chamada SHALL NOT conter <dados pessoais, cartão, segredo>`

## Testes (fase 6)

Nascem dos critérios de aceite, nunca do código escrito.

- **Simulado na suíte padrão.** Os testes da suíte de `testes.json` **não chamam a rede**: um servidor simulado no nível HTTP (ou um dublê da interface do adaptador, para os testes do domínio) responde como o fornecedor. Teste que precisa de rede para passar não entra na suíte padrão.
- **Contrato.** Amostras reais do sandbox (fase 3), **sanitizadas** (sem token, sem dado pessoal), versionadas na pasta de testes: o adaptador precisa interpretar cada uma. O simulador responde com as mesmas amostras, para ele não divergir do real. Contrato publicado pelo fornecedor (OpenAPI, esquema de eventos): validar requisições e respostas contra ele.
- **Falhas e lentidão**, um teste por critério: tempo esgotado, resposta lenta abaixo e acima do limite, 5xx seguido de sucesso, 5xx até esgotar as tentativas, 429 com `Retry-After`, conexão recusada, erro definitivo sem repetição, corpo malformado, campo ausente, campo novo, credencial expirada (401), disjuntor abrindo e fechando, chamada repetida com a mesma chave de idempotência, fila reprocessando e mandando para a fila de mortos, flag desligada, teto de custo.
- **Webhooks**: assinatura válida, inválida, ausente, fora da tolerância de horário, evento repetido, fora de ordem.
- **Sandbox (separado).** Testes contra o sandbox real ficam marcados e **fora** da suíte padrão (diretório ou marcador próprio, comando documentado). Rodam só com confirmação específica, com a chave de sandbox em variável de ambiente, na fase 7. **Nunca chave de produção.** No CI, só se o usuário aprovar guardar a chave de sandbox nos segredos do CI (ação externa).
- **Tempo nos testes**: relógio e espera controlados pelo teste (recuo e disjuntor sem `sleep` real), para a suíte não ficar lenta nem instável.
