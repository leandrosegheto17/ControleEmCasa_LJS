# ADR-012: Cobrança por lar via Asaas

- **Status:** Aceito em 2026-10-26 (fechamento do código da etapa 13, lotes 1 e 2), com a ressalva de que a validação no sandbox do Asaas ainda está pendente; se ela contradisser alguma premissa, este ADR é revisto.
- **Data:** 2026-10-26
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RN-24 e RN-25 do `PRD-TECNICO.md` (CA-24.1 a CA-24.11, CA-25.1 a CA-25.5, CA-T2.3, CA-T3.4); SDD §2.2 (módulo isolado `infraestrutura/asaas`), §3.3 e §3.4 (`webhook_evento`, `assinatura`), §4 (grants), §5.1 passo 9 e §5.4 (`exigePlano`), §6.2 (rotas de plano e webhook), §7 (erros), §8.5 (fluxo do webhook), §11.2 (`ASAAS_*`), E-4; GUARDRAILS G-28 a G-31, G-34, G-50; THREAT-MODEL TM-ASA-01 a TM-ASA-05, TM-API-09; ADR-005 e ADR-010
- **Pesquisa:** `.specs/etapa-13/pesquisa-asaas.md` (API do Asaas, com lacunas a medir no sandbox)

## Contexto

- O plano é do **lar** (Free ou Pro, R$ 9,90/mês por Pix); todo lar novo ganha 14 dias de trial Pro sem cartão, uma vez por titular (D4, CA-24.10). No Free, orçamento e metas ficam somente leitura, sem apagar nada (RN-25).
- O Asaas avisa por webhook com entrega "pelo menos uma vez", sem garantia de ordem, e a documentação sugere tratar o evento como gatilho e consultar o estado atual pela API. Não existe cabeçalho de idempotência na API (só `externalReference`).
- O CPF/CNPJ do titular é exigido pelo Asaas para criar o cliente, mas não pode ser guardado nem registrado (CA-24.11, G-34).
- O webhook é público e a URL é previsível (TM-ASA-01, TM-ASA-02).

## Decisão

1. **Uma linha de `assinatura` por lar**, criada com o lar (`POST /api/lar`): `trial` com `trial_ate = criação + 14 dias`, ou `free` com `trial_ate = criação` quando o usuário já tem `trial_usado_em` (marcado na criação do lar com trial). A linha guarda a situação, o período pago (`periodo_ate`), os ids do Asaas e a **cobrança atual** (id, vencimento, valor e `cobranca_situacao`: pendente, paga ou vencida). O CPF/CNPJ nunca é gravado: só `asaas_cliente_id`.
2. **Plano efetivo calculado, nunca guardado** (`dominio/plano.ts`, `planoEfetivo`). Pro se: o trial ainda vale (`agora < trial_ate`, em qualquer situação); ou a situação é `ativa`; ou há período pago em vigor (`agora < periodo_ate`, o que mantém a `cancelada` até o fim, CA-24.8); ou `atrasada` até o fim do 3º dia depois do vencimento da cobrança, no calendário de São Paulo (CA-24.9). Sem linha: Free (falha fechada). O trial vence sem evento nenhum (CA-24.2).
3. **`exigePlano('pro')` nas 4 escritas de orçamento e metas**, depois de `emTransacao`/`exigirLar` e antes de ler a rota e o corpo (RT-02: `plano_necessario` antes de `registro_invalido` e `valor_invalido`; CA-T2.3). Lê a assinatura na transação, pela RLS do lar, a cada requisição. Leituras ficam abertas.
4. **Módulo isolado `infraestrutura/asaas`**, só `fetch`, cabeçalhos `access_token` e `User-Agent`, sem SDK e sem importar nada de fora da pasta (regra do ESLint e teste). Interface: `criarCliente`, `criarAssinatura`, `listarCobrancasDaAssinatura`, `buscarCobranca`, `buscarPix`, `cancelarAssinatura`, `verificarWebhook` (SHA-256 dos dois tokens e XOR de todos os bytes: tempo constante) e `lerEvento`. Erros viram `ErroAsaas` sem o corpo da resposta (pode ecoar o CPF); a API traduz para 503 `indisponivel`.
5. **Assinar** (titular; convidado recebe `registro_invalido` antes de o corpo ser lido): trava a linha (`for update`), cria o cliente (ou reaproveita `asaas_cliente_id`), cria a assinatura Pix mensal de 990 centavos com 1º vencimento hoje (São Paulo) e `externalReference = lar_id`, busca a 1ª cobrança e o Pix. Queda do Asaas **antes** de a assinatura existir: 503 e nada gravado. **Depois** de criada, nada mais falha por causa do Asaas (a cobrança chega pelo webhook), para não criar uma segunda assinatura no reenvio. Idempotente: com uma assinatura esperando o 1º pagamento, devolve a mesma cobrança; `ativa` ou `atrasada` dão 409 `assinatura_ativa`. De `cancelada`, assinar de novo cria outra assinatura e volta a `trial` (se o trial ainda vale) ou `free`, o que separa a assinatura nova da removida.
6. **Cancelar** (titular): sem assinatura no Asaas ou já cancelada, 409 `sem_assinatura`. Cancela no Asaas (404 lá vale como cancelada) e grava `cancelada`, tirando a cobrança em aberto; o período pago continua.
7. **Webhook: o evento é gatilho** (decisão do usuário, etapa 13). Ordem: `LIMITE_WEBHOOK` → token em tempo constante (antes de tocar o banco; 401 `token_invalido` sem detalhe) → leitura do corpo (400 `valor_invalido` se não for um evento) → evento já registrado? 200 → **consulta a cobrança no Asaas** (e, se paga, a próxima em aberto da assinatura) fora de qualquer transação → transação de sistema (`app.sistema = 'webhook'`): trava a assinatura pelo id do Asaas, confere cliente e valor (G-29), aplica `aplicarEvento`, grava o evento (`on conflict do nothing`: o segundo de uma corrida vira "repetido" e não grava) e a assinatura → e-mails depois do COMMIT. Asaas fora do ar na consulta: 503 e nada gravado (o Asaas reenvia). Assinatura desconhecida: 200 e ignora. Respostas 200 trazem `{ ok, resultado }` (`aplicado`, `ignorado`, `repetido`).
8. **Transições (`aplicarEvento`), que nunca regridem:** evento mais velho que `ultimo_evento_em` é ignorado; a situação da cobrança vem da consulta, não do nome do evento; paga → `ativa` com `periodo_ate = max(periodo_ate, início do dia (vencimento + 1 mês))` (a mesma cobrança não soma duas vezes), e a cobrança atual passa a ser a próxima em aberto; `cancelada` paga só estende o período; vencida → `atrasada` só a partir de `ativa` (antes do 1º pagamento não há carência); pendente vira a atual se não houver outra **mais antiga** em aberto (a dívida vem primeiro); apagada ou estornada que era a atual em aberto sai da tela; `SUBSCRIPTION_DELETED`/`_INACTIVATED` → `cancelada`.
9. **`webhook_evento` só no contexto de sistema** (RLS com `app.em_sistema()`), sem DELETE para a app por enquanto (G-04; a poda entra com o cron). O resumo guarda só ids, situação, valor, datas e o resultado (G-50).
10. **E-mails**: cobrança gerada (cobrança nova vinda de `PAYMENT_CREATED`, não a que o assinar já mostrou), pagamento confirmado e atraso, ao titular, com o link de `URL_PUBLICA` + `/app/ajustes/plano`.

## Consequências

**Positivas**
- Evento forjado com o token vazado ainda não ativa nada: o estado vem da consulta ao Asaas e o valor e o cliente são conferidos.
- Repetição, corrida e inversão de eventos não mudam o resultado; a queda do Asaas no webhook só adia o processamento.
- O CPF/CNPJ não toca o banco nem os logs; o módulo pode ser extraído para os outros apps.

**Negativas**
- Cada evento de cobrança custa 1 ou 2 chamadas ao Asaas (dentro do limite de 25.000 por 12 h).
- `GET /api/plano` do titular com cobrança em aberto chama o Asaas para o Pix a cada abertura da tela; se falhar, o Pix vem nulo.
- Se o banco cair depois de o Asaas criar a assinatura, sobra uma assinatura órfã no Asaas (o reenvio cria outra). Mitigação futura: procurar por `externalReference` antes de criar (filtro não confirmado na pesquisa).
- O fuso de `dateCreated` foi assumido como horário de Brasília (`PREMISSA`, a medir no sandbox).
