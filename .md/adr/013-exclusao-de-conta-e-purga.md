# ADR-013: Exclusão de conta e purga

- **Status:** Aceito em 2026-10-26 (fechamento do código da etapa 14, lotes 1 e 2; ligar a purga em produção só na etapa 17)
- **Data:** 2026-10-26
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RN-26 do `PRD-TECNICO.md` (CA-26.1 a CA-26.10), CA-19.8, CA-23.12 e CA-24 (cancelamento no Asaas); decisões D1, D5 e D8 de 2026-10-24; SDD §3.3 (`exclusao_conta`), §4 (grants), §5.3 (`app.sistema`), §6.2 (rotas "Conta"), D-05, E-1, E-2; GUARDRAILS G-04, G-46, G-49; THREAT-MODEL TM-PUSH-01, TM-DB-05, E-01, E-02, E-08, E-17; ADR-005, ADR-009 e ADR-012

## Contexto

- Com cadastro aberto, a LGPD vale (RNF-14): o usuário precisa conseguir excluir a própria conta, e os dados somem em até 30 dias (os backups cifrados guardam por mais 30, CA-26.5).
- O lar tem até 2 membros. A exclusão do titular com convidado ativo foi decidida (D1): o lar é encerrado com aviso e some inteiro na purga, inclusive o individual do convidado.
- A role `app` não tem DELETE onde excluir não é regra (`meta`, `movimento_meta`, `despesa_fixa`, `lar`, `membro`, `usuario`...; G-04). A purga, portanto, não pode rodar na API.
- Toda tabela de negócio tem RLS com FORCE (G-01). O FORCE vale também para o **dono** da tabela. No docker local o owner é superusuário e passa por cima de tudo; no Neon (etapa 17) ele não será, e uma purga sem política para ele apagaria zero linhas, em silêncio.
- Duas pendências antigas dependiam da purga: a parte privada (`lancamento_pagamento`) do membro **removido** pelo titular (etapa 8) e o `movimento_conta` do ex-membro (etapa 10).

## Decisão

1. **Pedido** (`POST /api/conta/exclusao`, autenticado, `{senha}` → 202): confere a senha do usuário da sessão com o mesmo bloqueio do login (5 falhas em 15 min por e-mail ou IP → `muitas_tentativas`), abre um pedido em `exclusao_conta` (um em aberto por usuário) e manda o link `/confirmar-exclusao#t=<token>` (token de 256 bits, só o SHA-256 no banco, 30 min, uso único, `token_email` com finalidade `exclusao`; no máximo um e-mail a cada 2 min). **Nada muda na conta** (CA-26.1).
2. **Confirmação** (`POST /api/conta/exclusao/confirmar`, pública, `{token}` → 204 | 400 `link_expirado`), numa única transação: consome o token, confirma o pedido com `purgar_em = confirmada_em + 30 dias`, apaga todas as sessões e, com a identidade do usuário em GUC local (as políticas do lar valem como em qualquer rota dele):
   - **titular** (com ou sem convidado): revoga o convite pendente, cancela a assinatura no Asaas (como no descarte de lar da etapa 13: falha do Asaas não impede a confirmação, vai ao log `asaas_cancelamento_pendente`) e, havendo convidado ativo, manda a ele o e-mail `lar_encerrado` com a data da purga (D1, CA-26.7). O lar continua funcionando para o convidado até a purga;
   - **convidado**: sai do lar como na saída voluntária (CA-23.12): a parte privada das conjuntas que pagou é apagada na hora, o nome vira "Ex-membro";
   - **sem lar**: só as sessões.
3. **Conta em exclusão não reativa** (D8, CA-26.6): o login com a senha certa recebe 403 `conta_em_exclusao` e nenhuma sessão é criada; com a senha errada, `credenciais_invalidas` (não revela o estado). A rota `POST /api/conta/exclusao/cancelar` do SDD §6.2 **não é implementada**, porque contradiz a D8 e o CA-26.6 (o PRD prevalece).
4. **Aviso no app** ao convidado (CA-26.7): `GET /api/sessao` ganha a chave opcional `encerramento: { purga_em }`, presente só para o membro cujo titular confirmou a exclusão.
5. **Purga** por `backend/scripts/purgar.ts`, no GitHub Actions (`.github/workflows/purga.yml`, todo dia às 05:00 de Brasília, environment `producao`, segredos só por referência, inerte até a variável `PURGA_ATIVA` ser `true` na etapa 17), com a role owner (exceção registrada ao "owner só nas migrations", D5/E-08). Cada unidade na sua própria transação, com `app.sistema = 'purga'` como GUC local:
   - exclusões vencidas (até `PURGA_LIMITE`, padrão 50, as mais antigas primeiro): todo lar **criado** pelo usuário (o do titular, com o convidado dentro, e os lares descartados no aceite de convite) some por inteiro; o individual dele nos lares em que era convidado some; o usuário é apagado (sessões, tokens e aceites em cascata; `membro.usuario_id` vira nulo; o e-mail fica livre, CA-26.4); a linha de `exclusao_conta` fica, só com ids e datas, marcada `purgada_em`;
   - **Asaas antes de apagar**: se a assinatura de um desses lares não está `cancelada` (a confirmação falhou no Asaas), a purga cancela primeiro; se o Asaas falhar ou não estiver configurado, **nada daquele usuário é apagado** e a falha vai ao relatório, para a próxima execução;
   - ex-membros (saída ou remoção) há 30 dias ou mais: o individual some (contas, formas, movimentos de conta, parte privada das conjuntas, lançamentos, orçamentos e metas individuais, categorias individuais). As conjuntas que pagaram, as metas conjuntas e os movimentos delas ficam, com "Ex-membro" e sem a conta. Isso fecha as pendências das etapas 8 e 10;
   - contas nunca confirmadas há 7 dias (CA-19.8);
   - poda: tentativas de login com mais de 30 dias, tokens vencidos há mais de 30 dias, sessões expiradas há mais de 30 dias e eventos do webhook com mais de 12 meses (RN-26), em lotes de 1.000.
6. **Políticas da purga para o owner**: cada tabela com RLS ganha `purga_select` e `purga_delete` `to controle_owner using (app.em_purga())`, criadas por laço na migração. Sem o GUC, o owner não enxerga nada. A role `app` não ganha privilégio nenhum. Os testes rodam a purga com uma role de login membro de `controle_owner`, **sem** SUPERUSER e **sem** BYPASSRLS, como o owner será no Neon.
7. **Relatório e log** só com contagens, ids técnicos (uuid da exclusão, do membro, do lar) e motivos (`asaas_indisponivel`, `asaas_sem_configuracao`, SQLSTATE). Saída 1 se alguma unidade falhou (o workflow fica vermelho), 2 sem a URL do banco.

## Alternativas consideradas

- **Login cancela a exclusão dentro dos 30 dias** (rota `.../cancelar` do SDD): descartada pela D8; a decisão foi não reativar.
- **Purga no Cron do Worker com a role `app`**: exigiria DELETE em `meta`, `movimento_meta`, `despesa_fixa`, `lar`, `membro` e `usuario` para a `app`, contra o G-04.
- **Role `purga` própria**: descartada em E-08; mais uma credencial para guardar.
- **Owner com BYPASSRLS no Neon**: dependeria de um atributo que o Neon pode não dar e que valeria para tudo; as políticas por GUC deixam o acesso preso ao contexto da purga.
- **Convidado que exclui a conta fica no lar até a purga**: o titular ficaria 30 dias com um membro que não entra, e o lar "cheio" sem poder convidar outra pessoa. Descartada: vale a regra de saída.

## Consequências

**Positivas**
- A `app` continua sem DELETE onde não é regra; a purga é auditável (relatório) e reexecutável: falha de uma unidade não desfaz as outras, e a próxima execução continua.
- Nenhuma assinatura do Asaas fica cobrando um lar apagado: o lar só some depois do cancelamento.
- Uma tabela nova com `lar_id` (ex.: `push_subscription`, etapa 15) quebra o teste de catálogo até entrar na ordem de exclusão.

**Negativas**
- O owner precisa de LOGIN todo dia no GitHub Actions (o SDD §4 dizia `NOLOGIN` fora do deploy): a credencial fica só no environment `producao`, e o runbook da etapa 17 registra isso.
- A purga chama o Asaas com uma transação aberta (curta, um usuário por vez).
- Uma escrita concorrente do convidado durante a purga do lar faz a unidade falhar por FK; ela é refeita no dia seguinte.

## Pendências

- Etapa 15: `push_subscription` e `preferencia_notificacao` entram em `TABELAS_DO_LAR` (o teste de catálogo obriga) e a confirmação apaga as inscrições de push na hora (G-49, CA-27.6).
- Etapa 15: o Cron do Worker `30 6 * * *` (limpeza curta do SDD §11.1: convites vencidos viram `expirado`, poda de 24 h) nasce com o `scheduled`; a purga já cobre a poda de 30 dias.
- Etapa 17: criar o environment `producao` com `NEON_URL_OWNER` (era `DATABASE_URL_OWNER` até o ADR-017), `ASAAS_API_KEY` e a variável `ASAAS_API_URL`, e ligar `PURGA_ATIVA`.
- Lote 2 desta etapa: telas de pedido (Ajustes → Conta), `/confirmar-exclusao`, aviso ao convidado, landing, `/termos` e `/privacidade` (informar a retenção de 30 dias dos backups, CA-26.5).
