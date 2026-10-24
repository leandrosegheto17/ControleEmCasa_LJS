# Objetivo e público (fase 1)

Responde: **para quem documentar e para quê?** Documento sem leitor definido vira lista genérica que ninguém lê.

## Conversa

Uma pergunta por vez, via `AskUserQuestion`, com sugestão e "Ainda não sei" nas abertas:

1. **Quem vai ler** (várias escolhas): você mesmo daqui a meses, novo dev entrando no projeto, agente de IA, cliente ou usuário final, auditor ou comprador (avaliação de terceiros).
2. **Para quê**: onboarding, manutenção, auditoria, contexto para agentes, entrega ao cliente.
3. **Profundidade**: **enxuta** (README que roda, visão de arquitetura e contexto para IA; recomendada quando ninguém pediu mais) ou **completa** (todas as fases do público).
4. **Onde fica**: siga a convenção do projeto (veja `levantamento.md` se já existir, ou olhe a raiz: há `docs/`? README longo? `CLAUDE.md`, `AGENTS.md`, `.cursorrules`?). Sem convenção, recomende: `README.md` para começar, `docs/` para o resto, `CLAUDE.md` para a IA (com `AGENTS.md` se o time usar outras ferramentas; veja `contexto-ia.md`).
5. **Restrições**: o repositório é público? Há algo que não pode ser escrito (cliente, contrato, dado pessoal)? A documentação vai para fora do repositório (wiki, site)? Publicar fora é ação externa, com confirmação específica.

## Público × documentos e fases

| Público | Documentos típicos | Fases que costumam ficar `dispensada` |
|---|---|---|
| Você mesmo | README (rodar, testar, publicar), `docs/arquitetura.md`, riscos | 6 se o código é pequeno |
| Novo dev | README, `docs/arquitetura.md`, `docs/fluxos.md`, `docs/convencoes.md` (ou `CONTRIBUTING.md`) | — |
| Agente de IA | `CLAUDE.md`/`AGENTS.md` curto | 5 e 6 viram insumo, sem documento próprio |
| Cliente ou usuário final | guia de uso (o que o sistema faz, passo a passo, erros comuns), sem detalhes internos | 4 (só o contexto, se ajudar), 6, 7, 8 |
| Auditor ou comprador | `docs/arquitetura.md` (integrações, dados, autenticação), fluxos, riscos e dívidas | 8 se não houver IA no time |

Inventário (2) e execução (3) nunca ficam dispensadas: são a fonte do resto. Público misto soma as linhas, um documento por necessidade, sem repetir conteúdo entre eles (um aponta para o outro).

## Modelo de `documentacao.md`

É também o **contrato de entrada** quando outro fluxo chama esta skill.

```markdown
# Documentação: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto> · **Modo**: <primeira | revisão de `<slug anterior>`>
- **Chamado por**: <usuário | fluxo N <pasta>> · **Usar em**: <arquivo do chamador | —>
- **Público**: <leitores> · **Usos**: <...> · **Profundidade**: <enxuta | completa>
- **Restrições**: <repositório público, o que não pode ser escrito, publicação externa | nenhuma>
- **Branch**: <`docs/<slug>` | pendente>
- **Resultado**: <pendente | concluída | parada — <motivo>>

## Fases
| # | Fase | Situação |
|---|---|---|
| 1 | Objetivo e público | pendente · feita (<data>) · dispensada — <motivo> |
| 2 | Inventário | ... |
| 3 | Execução | ... |
| 4 | Arquitetura | ... |
| 5 | Comportamento | ... |
| 6 | Convenções | ... |
| 7 | Riscos e dívidas | ... |
| 8 | Contexto para IA | ... |
| 9 | Validação e manutenção | ... |

## Documentos
| Documento | Público | Destino no repositório | Fase | Situação |
|---|---|---|---|---|
| Como rodar | novo dev | `README.md` (seção) | 3 | a escrever · escrito · validado |

## Achados fora do escopo
- <defeito, dívida ou risco visto no caminho> — <anotado | skill `bug` em `.specs/bugs/<slug>/` | `dividas.md`>

## Manutenção
(preenchida na fase 9)
```
