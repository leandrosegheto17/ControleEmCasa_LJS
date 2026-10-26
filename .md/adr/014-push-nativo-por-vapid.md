# ADR-014: Push nativo por VAPID

- **Status:** Proposto em 2026-10-26 (etapa 15, lote 1: backend). Aceitar ao fechar a etapa 15, depois do lote 2 (service worker, Ajustes, aviso do iOS) e de um envio real a um navegador.
- **Data:** 2026-10-26
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RN-27 do `PRD-TECNICO.md` (CA-27.1 a CA-27.8); decisão P8; SDD §2.2 (módulo `push`), §3.6, §4, §5.3, §6.2 "Push", §8.6, §11.1 e §11.2; GUARDRAILS G-02, G-04, G-32, G-36, G-39, G-46, G-49, G-50; THREAT-MODEL TM-PUSH-01 a TM-PUSH-06, E-07, E-15; ADR-005, ADR-010, ADR-011 e ADR-013

## Contexto

- O casal quer ser lembrado de três coisas (P8): fixa vencendo ou atrasada, lembrete diário opcional de lançar e meta atingida. O app é um PWA; não há app nativo nem serviço de mensagens pago.
- O Worker roda no Cloudflare Workers: sem `node:crypto` completo, sem SDK pesado, com limite de CPU por requisição. O Web Push padrão (RFC 8030) exige JWT ES256 (VAPID, RFC 8292) e criptografia da mensagem (`aes128gcm`, RFC 8291/8188), que a Web Crypto (`crypto.subtle`) faz.
- A notificação aparece na tela bloqueada e pode chegar a um aparelho compartilhado (TM-PUSH-02); a meta individual de um membro não pode chegar ao outro (TM-PUSH-05).
- O cron enxerga vários lares; uma política "de sistema" ampla nas tabelas de negócio faria de um defeito um vazamento (TM-PUSH-01, E-07).

## Decisão

1. **Web Push nativo, sem SDK, num módulo isolado** `backend/api/src/infraestrutura/push` (decisão 4 do PLANO): `enviarPush(assinatura, carga, vapid, opções) → 'ok' | 'expirada' | 'falha'` e `chavePublica(vapid)`. Só `fetch` e `crypto.subtle`; não importa nada do resto da API nem do banco, não usa `node:*` e não escreve log (regra do ESLint e teste de fronteira). A criptografia é conferida byte a byte com o exemplo do RFC 8291, apêndice A.
   - JWT ES256: `aud` = origem do endpoint, `exp` = agora + 12 h, `sub` = `VAPID_SUBJECT` (`mailto:`); cabeçalho `Authorization: vapid t=…, k=…`.
   - Cabeçalhos `TTL` (padrão 12 h), `Urgency` (`normal`) e `Topic` (por tipo de aviso).
   - 2xx → `ok`; 404/410 → `expirada`; qualquer outro status, erro de rede, tempo esgotado (10 s) ou chave inválida → `falha`. Nunca lança.
2. **Chaves VAPID** como as do SDD §11.2 (pública de 65 bytes e `d` privado de 32, base64url). Até o par de produção existir (etapa 17), as três variáveis (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) vão por `wrangler secret` e, no local, `.dev.vars`; nenhum valor no repositório. `pnpm --filter @controle/scripts gerar-vapid` só imprime um par novo. Nos testes o par é aleatório a cada execução. Sem as três, `GET /api/push/chave` responde 503 `indisponivel` e o cron não envia nem marca nada.
3. **Tabelas** (migração `20261030120000_push.sql`):
   - `push_subscription`: uma linha por aparelho (endpoint único, só `https:`, até 1024), ligada a **usuário**, lar e membro. A leitura e a remoção pela sessão são por `usuario_id` (para o "sair de todos" e a exclusão alcançarem também a inscrição feita num vínculo anterior); a inclusão exige o vínculo atual. O cron lê, atualiza `ultimo_envio_em`/`falhas` e remove. A `app` não altera chaves nem endpoint.
   - `preferencia_notificacao`: as três preferências do membro (`fixas`, `lembrete_diario`, `lembrete_hora` de 0 a 23, `metas`); sem linha = padrões (fixas e metas ligadas; lembrete desligado, às 20h). Só o próprio membro lê e grava; o cron lê; sem DELETE.
   - `aviso_push`: um registro por (membro, tipo, referência, dia de São Paulo). É a idempotência do CA-27.4: o aviso só sai se o registro entrou agora (`on conflict do nothing`). Só o cron toca; podado no dia seguinte.
   - As três entram em `TABELAS_DO_LAR` da purga e no individual do ex-membro.
4. **Contexto do cron**: `app.em_cron()` (só `app.sistema = 'cron'`, mais estrito que `app.em_sistema()`). O cron pagina os lares que têm aparelho e processa **um lar por transação**, com o lar fixado por `set_config` local; fixas, ocorrências e lançamentos são lidos pelas políticas normais do lar (e do membro, no lembrete). As tabelas de negócio **não** ganham política de sistema.
5. **Regras dos avisos** (texto fixo, sem valor, descrição nem nome; URL relativa `/app/...`):
   - *Fixa vencendo*: ocorrência não paga que vence amanhã. *Fixa atrasada*: não paga que venceu ontem (o primeiro dia em atraso). A partir das 9h de São Paulo; as horas seguintes do mesmo dia só retomam o que não saiu. Um aviso por membro e por tipo no dia, aos dois membros (a fixa é do lar). O cron gera as ocorrências do mês como a API faz ao abrir a tela.
   - *Lembrete diário*: só para quem ligou, na hora escolhida, e se ele não criou nenhum lançamento no dia (o do outro membro não conta).
   - *Meta atingida*: na transição de não atingida para atingida (aporte ou alvo editado), depois do COMMIT da escrita, em `waitUntil`, numa conexão própria. Os destinatários são calculados na transação do usuário pela regra de visibilidade (conjunta: os membros ativos; individual: só o dono). Com ROLLBACK nada sai.
   - Todo aviso respeita a preferência do membro e sai no máximo uma vez por (membro, tipo, referência, dia).
6. **Resultado do envio**: `ok` grava `ultimo_envio_em` e zera `falhas`; `expirada` remove a inscrição; `falha` soma 1 e remove na 5ª seguida. O envio acontece fora de transação; o resultado volta numa transação curta. Um aparelho ou um lar que falha não derruba o lote (vai ao log só com o nome do erro).
7. **Rotas**: `GET /api/push/chave` (sessão), `POST /api/push/assinaturas` (sessão e lar; idempotente pelo endpoint; o mesmo endpoint de outro usuário passa a ser de quem inscreve agora, porque quem tem o endpoint tem o navegador; no máximo 10 aparelhos por usuário, sai o de uso mais antigo), `DELETE /api/push/assinaturas` (sessão, sem exigir lar; só a do próprio usuário), `GET`/`PUT /api/notificacoes/preferencias` (sessão e lar). O endpoint só é aceito de serviços de push conhecidos (FCM, Mozilla, Apple, WNS), para o Worker não virar proxy de requisição.
8. **"Sair de todos" e exclusão** removem todas as inscrições do usuário (CA-27.6, G-49). O "sair" de um aparelho só remove no servidor quando o front chama o `DELETE` antes (G-39, lote 2).
9. **Crons** no `wrangler.jsonc`: `0 * * * *` (avisos) e `30 6 * * *` (limpeza diária: convites pendentes vencidos viram `expirado`; sessões já expiradas, tentativas com mais de 24 h, tokens vencidos há mais de 1 dia e avisos antigos são apagados). A poda de 30 dias e a do webhook seguem na purga (ADR-013).

## Alternativas consideradas

- **Biblioteca `web-push`**: depende de `node:crypto`, `http`/`https` e Buffer; no Workers exigiria polyfills e não ficaria isolada. Descartada.
- **Serviço de terceiros (OneSignal, FCM direto)**: mais um fornecedor com dados pessoais (A-04) e custo; o Web Push padrão basta para um PWA.
- **"Meta atingida" pelo cron de hora em hora**: atrasaria até uma hora o aviso de um evento que o usuário acabou de causar; o SDD §8.6 pede o envio depois do COMMIT.
- **Política de sistema (`select` com S) em `despesa_fixa`, `ocorrencia_fixa` e `meta`, como no SDD §3.5**: desnecessária com o cron lar a lar; ficou de fora (menor privilégio, TM-PUSH-01).
- **Idempotência por coluna (`ultimo_envio_em` da inscrição)**: não distingue tipo nem referência, e um aparelho novo receberia de novo. Descartada pela tabela `aviso_push`.
- **Endpoint de outro usuário recusado com 409**: deixaria os avisos de A chegando ao aparelho que agora é de B (TM-PUSH-02). Descartada.

## Consequências

**Positivas**
- Nenhuma dependência nova; o módulo é extraível para os outros dois apps.
- O cron não ganha leitura ampla de dado de negócio; a notificação leva só texto fixo.
- Aviso perdido por queda no meio do lote é retomado na hora seguinte, sem duplicar.

**Negativas**
- Entrega "no máximo uma vez": se o serviço de push falhar no envio marcado, aquele aviso do dia não é refeito.
- A meta atingida usa a transação de sistema a partir de uma escrita de usuário (depois do COMMIT, só para os membros já calculados pela RLS do usuário).
- Uma tabela a mais que o SDD (`aviso_push`, 26 tabelas) e a coluna `usuario_id` na inscrição.

## Pendências

- Lote 2 desta etapa: service worker com `push` e `notificationclick` (abre a `url` da carga, relativa), assinatura no navegador com a chave de `GET /api/push/chave`, preferências em Ajustes → Notificações, instrução e aviso do iOS (só com o PWA instalado), remoção da inscrição ao sair (G-39).
- Validar com navegadores reais (Chrome/FCM, Firefox/Mozilla, Safari e iOS/APNs): entrega, `Topic`, `TTL`, resposta 410 de inscrição revogada.
- Etapa 17: gerar o par VAPID de produção (`gerar-vapid`), gravar com `wrangler secret`, e decidir se a chave pública e o contato passam a `vars` do `wrangler.jsonc` (SDD §11.1).
