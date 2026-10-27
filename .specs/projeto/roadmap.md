# Roadmap

Uma linha por etapa do `.md/PLANO.md`; a etapa 17 foi dividida em 17a a 17d e entrou a 18 (decisão AD-001 em `.specs/STATE.md`, 2026-10-27). Só a etapa `Em andamento` tem `tasks.md`; as outras ganham o seu quando chegar a vez, por isso o total de tarefas cresce. A **Situação** usa o vocabulário fixo da skill `progresso` (`Concluída`, `Em andamento`, `Não começada`); troque-a no mesmo commit da aprovação da etapa.

| # | Etapa | Situação | Observação |
|---|---|---|---|
| 0 | Documentos de método | Concluída |  |
| 1 | Esqueleto do monorepo | Concluída |  |
| 2 | Banco: base e identidade | Concluída |  |
| 3 | API: esqueleto no Worker | Concluída |  |
| 4 | Auth própria | Concluída |  |
| 5 | Domínio puro | Concluída |  |
| 6 | Lar, membros e isolamento | Concluída |  |
| 7 | Cadastros | Concluída |  |
| 8 | Lançamentos | Concluída |  |
| 9 | Despesas fixas e resumo do mês | Concluída |  |
| 10 | Orçamento e metas | Concluída |  |
| 11 | Front: base e acesso | Concluída |  |
| 12 | Front: telas do app | Concluída |  |
| 13 | Cobrança Asaas | Concluída | Código fechado (ADR 012 aceito); falta a validação no sandbox do Asaas |
| 14 | Landing e LGPD | Concluída | Código fechado (ADR 013 aceito); falta a revisão jurídica dos textos |
| 15 | Web Push | Concluída | Código fechado (ADR 014 aceito); falta validar o envio real em navegadores e o par VAPID de produção (etapa 17) |
| 16 | Operação e qualidade | Concluída | Lotes 1 e 2 aprovados em 2026-10-27; ADR 015 Aceito; validação em produção na etapa 17 |
| 17a | Publicação: repositório pronto para produção | Em andamento | P (~11h, 7 tarefas). `.specs/features/publicacao-repositorio/tasks.md`: domínio custom, CSP do Sentry, `conferir-banco`, fumaça ampliada, medições de CPU e de retomada a frio, roteiro de ativação. Depende de 16 |
| 17b | Publicação: infraestrutura de produção | Não começada | M (~14,5h, 14 tarefas previstas, quase todas ação do usuário com evidência). Neon (roles, banco `controle`, branch `dev`, ensaio de migração, migrar a `main`), Hyperdrive sem cache, `age`, VAPID e HMAC, environment `producao`, secrets e variáveis, tokens de menor escopo, Resend, Sentry, Asaas produção, domínio. Roteiro em `.specs/etapa-17/neon.md`. Depende de 17a |
| 17c | Publicação: primeiro deploy e medições | Não começada | M (~14h, 11 tarefas previstas, mais 2h de plano B condicional se o ratelimits não existir no Free). Primeiro deploy, fumaça com e-mail real, validar `conferir` e rollback, CPU, retomada a frio e Início ≤ 2 s, Lighthouse publicado, UptimeRobot, restauração com o 1º backup real, `BACKUP_ATIVO`, branch de restauração, `PURGA_ATIVA`. Depende de 17b |
| 17d | Publicação: abertura ao público | Não começada | M (~8h de construção, 6 tarefas previstas). 5 lacunas do sandbox Asaas e cobrança real mínima, revisão jurídica (externa) e marcadores `[A PREENCHER]` com versões dos termos, push real (FCM, Mozilla, iOS instalado), fechar ressalvas dos ADRs 012, 013 e 014. Depende de 17c |
| 18 | Casa: remover membro e sair do lar | Não começada | P (~6,5h, 4 tarefas previstas, com spec própria). Pendência do front desde a etapa 12. Depende de 17c |
