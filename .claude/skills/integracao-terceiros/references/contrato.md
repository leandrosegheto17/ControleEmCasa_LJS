# Contrato (fase 3)

Responde: **como o serviço se comporta de fato?** Primeiro o que a documentação atual diz (com data), depois o que o sandbox mostra. A diferença entre os dois é o achado mais valioso desta fase.

## 1. Documentação atual (agente `pesquisador`)

Rode `date` e passe a data da consulta. Pedido:

```
Pesquisa: contrato da API de <fornecedor> para <caso de uso>. Data da consulta: <AAAA-MM-DD>.
Só fontes primárias (documentação oficial, referência da API, changelog, página de status, termos).
Para cada item, a URL e o que diz; o que não achar, "não encontrado".
1. Autenticação: tipo (chave, OAuth, assinatura), escopos ou permissões disponíveis, expiração e renovação, chaves separadas de teste e produção.
2. Operações que o caso de uso precisa: método, caminho, campos obrigatórios, formato de resposta.
3. Erros: códigos e formato do corpo; quais são transitórios (vale tentar de novo) e quais não.
4. Limites: requisições por segundo/minuto, cotas diárias, tamanho de carga, cabeçalhos de limite e Retry-After.
5. Paginação e ordenação; consistência (o que acabei de criar já aparece na listagem?).
6. Idempotência: aceita chave de idempotência? por quanto tempo vale?
7. Webhooks: eventos, como autenticar (assinatura, segredo, tolerância de horário), repetição em falha, ordem garantida ou não, como reprocessar.
8. Versões: versão atual, como fixar a versão, política de depreciação e prazo de aviso, changelog e canal de avisos (e-mail, RSS, página).
9. Sandbox: existe? diferenças conhecidas para produção, dados de teste (cartões, CPFs), limites próprios.
10. Tempo de resposta esperado e SLA publicado; página de status e histórico de incidentes dos últimos 12 meses.
11. SDK oficial: linguagens, manutenção (último release), se cobre as operações acima.
Evidências contra: reclamações recentes (até 12 meses) de comportamento diferente do documentado.
```

A sessão monta a tabela de itens com o que voltou. Afirmação sem URL fica `PREMISSA`.

## 2. Sandbox (skill `spike`)

Só quando o comportamento real é incerto e importa (contrato de entrada em [composicao.md](composicao.md)). Prioridade para os itens **críticos**: autenticação, a operação principal, um erro transitório e um definitivo, idempotência, assinatura de webhook. Limite de taxa real só se o pico chegar perto dele.

- Cada chamada ao sandbox é **ação externa**: confirmação específica no início do experimento, com a lista de chamadas e a conta usada. Conta e chave de sandbox são criadas pelo usuário; a chave fica em variável de ambiente.
- **Nunca chave de produção**, nem "só para conferir".
- Respostas reais gravadas em `evidencias/` (fora do git: na primeira vez, garanta `.specs/integracoes/*/evidencias/` no `.gitignore` do projeto, mostrando o diff), sem token e sem dado pessoal. As que servirão de amostra para os testes de contrato (fase 6) são **sanitizadas** e vão para a pasta de testes do projeto na construção, não agora.
- Sem sandbox: itens críticos ficam `não testável — <motivo>` e o risco segue para a fase 7 e para o plano de liberação.

## 3. Saída de emergência

Volte à fase 2 quando: item crítico diverge sem contorno razoável; limite ou cota abaixo do pico esperado sem plano pago viável; SLA ou histórico de incidentes incompatível com a criticidade de `terceiro.md`; ausência de versão fixável com histórico de mudança sem aviso.

## Modelo de `contrato.md`

```markdown
# Contrato: <fornecedor> — <caso de uso>

- **Consultado em**: <AAAA-MM-DD> · **Versão da API**: <versão fixada | não fixável>
- **Sandbox**: <sim — conta de <quem> | não> · **Spike**: <.specs/spikes/<slug>-contrato/registro.md | não feito — motivo>
- **SDK**: <oficial <nome versão> | HTTP direto — motivo>
- **Canal de mudanças**: <changelog URL, e-mail, RSS> · **Status**: <URL>

## Itens

| # | Item | Documentado | Situação | Crítico | Fonte |
|---|---|---|---|---|---|
| C-01 | Autenticação: <...> | <...> | documentado · confirmado no sandbox · diverge: <...> · não testável — <motivo> | sim | <URL (data) · evidencias/...> |

## Erros

| Código ou tipo | Significado | Transitório? | O que faremos |
|---|---|---|---|

## Limites e custo

- **Taxa**: <N/s> · **Cota**: <N/dia> · **Pico esperado**: <de terceiro.md> · **Folga**: <x vezes>
- **Preço no volume**: <R$ ou US$ por N, com taxa e câmbio> — <fonte (data)>

## Webhooks

<eventos usados, autenticação, repetição, ordem, reprocessamento | não usa>

## Divergências e riscos

- <item, o que diverge, efeito, decisão: contornar | voltar à escolha | aceitar com risco>
```
