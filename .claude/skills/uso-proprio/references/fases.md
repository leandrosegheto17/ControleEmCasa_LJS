# As 9 fases do uso próprio

Princípio: **isso vale o meu tempo e funciona na minha infraestrutura, com custo zero?** Toda fase pode terminar em "parar", e isso é válido.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Necessidade | Que dor isso resolve? Já existe algo pronto? | `necessidade.md` §1 e §2 | Necessidade clara; alternativas prontas avaliadas | Opus |
| 2 | Escopo pessoal | O que é o essencial para eu usar de verdade? | `necessidade.md` §3 | Lista curta e critério de "bom o bastante" | Opus |
| 3 | Restrições e viabilidade | Onde roda, quanto custa, e os dados? | `necessidade.md` §4 a §6, veredito | Cabe no ambiente e no custo zero; backup definido; veredito `construir` | Opus |
| 4 | Desenho enxuto | Qual a estrutura mais simples que serve? | `features/<app>/spec.md` (e `design.md`, se precisar) | Spec aprovada, com backup, restauração e (se na internet) autenticação e HTTPS como critérios | Opus |
| 5 | Preparação | Como vou trabalhar? | ambiente Docker, esqueleto, scripts de backup e restauração | Esqueleto rodando no destino | Sonnet |
| 6 | Construção | Cada fatia já é usável? | código, testes, commits | Tarefas concluídas com o gate passando | Sonnet |
| 7 | Validação | Funciona, é seguro e os dados estão a salvo? | `validation.md` (PASS); `seguranca.md` se exposta pela internet | PASS, restauração testada, sem achado crítico ou alto | Sonnet |
| 8 | Implantação | Como coloco no ar com pouco esforço? | `.specs/implantacao.md`, script único | No ar, teste de fumaça e backup conferidos | Sonnet |
| 9 | Uso e manutenção | Continua útil e funcionando? | revisões periódicas registradas em `implantacao.md` | Decisão manter / evoluir / aposentar | Sonnet |

## Checklist da revisão periódica (fase 9)

Sugira fazer a cada 1 a 3 meses, ou quando o usuário voltar ao projeto:

- [ ] **Ainda uso?** Se não usou no último período, considerar aposentar.
- [ ] **Backup:** rodou dentro do esperado? Restaurar um backup recente numa cópia limpa.
- [ ] **Dependências:** há atualização de segurança? (`npm audit`, `pip-audit` ou equivalente)
- [ ] **Plano gratuito** (nuvem): os limites mudaram? O projeto está perto de algum limite ou corre risco de ser pausado ou apagado?
- [ ] **Exposição:** continua só na rede local, ou passou a ser acessada pela internet?
- [ ] **Decisão:** manter, evoluir (vira feature, fluxo 3, ou volta à fase 4) ou aposentar.

**Aposentar:** exportar os dados num formato aberto, parar e remover o serviço, registrar em `implantacao.md` onde ficou a exportação.

## Laços comuns

- Algo pronto resolve → encerrar com veredito `adaptar algo pronto`.
- Restrição de infraestrutura impede (plano gratuito pequeno demais) → rever escopo (fase 2) ou destino (fase 3).
- Restauração do backup falhou → correção na fase 6; não implantar.
