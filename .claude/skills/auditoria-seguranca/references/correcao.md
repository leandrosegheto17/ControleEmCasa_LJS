# Correção e reteste (fase 8)

Do mais grave ao menos grave, **um bug de cada vez**. Só entram os achados com destino "corrigir" em `achados.md`. Com a fase 8 fora da lista de **Fases** (escopo restrito, ex.: código de terceiro), grave `correcoes.md` só com **Críticos e altos fechados**: `não se aplica — <motivo>` e siga para a 9.

## 1. Relato para a skill `bug`

Para cada achado (ou grupo com a mesma causa), grave `.specs/bugs/<slug>/relato.md` completo no formato da skill `bug` (`.claude/skills/bug/references/relato.md`), slug `seg-<sec-id>-<resumo>` (ex.: `seg-001-pedido-de-outra-conta`), e acione a skill `bug`. Ela começa na reprodução (fase 3) e devolve depois do fechamento.

| Campo do relato | O que vai |
|---|---|
| **Chamado por** | `auditoria <id> SEC-NNN` (todos os IDs, se agrupados) |
| **Devolver após** | `fechamento` |
| **Relatado por** / **Fonte** | auditoria de segurança · teste (`.specs/seguranca/<id>/achados.md`) |
| **Esperado** | o comportamento seguro e onde está definido (ex.: "só o dono lê o pedido"; regra do modelo de ameaças `TM-NNN`) |
| **Obtido** | a falha, sem segredo por inteiro |
| **Passos** | a **Prova** do achado (sonda ou comando), com a conta de teste usada |
| **Ambiente** | onde foi confirmado (local ou staging) e o commit |
| **Impacto** | cenário de exploração e ativos atingidos; **Contorno**: a mitigação, se houver |
| **Severidade** | crítico → P0, alto → P1, médio → P2, baixo → P3, com a justificativa de `achados.md`; urgência conforme a tabela de severidade |
| **Veredito** | `bug confirmado` (ou `provável bug, falta reproduzir`, se só confirmado por leitura) |

Anote no relato: "falha encontrada por auditoria preventiva; **sem indício de exploração**". Assim a triagem não confunde com incidente (se houver indício, a auditoria já parou e foi para a skill `incidente`).

**Critérios de aceite** do relato:

1. **O ataque não funciona mais:** dado <estado da Prova>, quando <passos da Prova>, então <resposta segura: 403/404, entrada rejeitada, valor escapado...>.
2. **Teste automatizado do ataque**, pela entrada pública mais próxima (ex.: requisição da conta B ao recurso da conta A), que falha antes da correção e passa depois; mais um por local afetado pela mesma causa.
3. **O uso legítimo continua funcionando** (a conta A ainda lê o próprio pedido).

## 2. Casos especiais

- **Segredo exposto:** o que resolve é **trocar a credencial** no provedor e revogar a antiga (ação externa: confirmação específica, normalmente feita pelo usuário, com o passo a passo redigido). Tirar do código (ler de variável de ambiente ou cofre) vai pela skill `bug`, com a busca de segredos sem acusar o arquivo como critério. Reescrever o histórico do git não substitui a troca e é difícil de desfazer: só com confirmação específica.
- **Dependência vulnerável:** atualizar pela skill `bug`; critério: a varredura não acusa mais e a suíte continua verde. Sem versão corrigida: mitigação (desligar a função, validar a entrada antes) e risco aceito com prazo.
- **Configuração ou infraestrutura** (cabeçalho, CORS, debug): mudança versionada com teste ou checagem automatizada que falharia sem ela (regra de testes do `CLAUDE.md`), pela skill `bug`.
- **Correção grande** (exige mudar autenticação ou arquitetura): a skill `bug` já para e propõe o caminho; enquanto isso, mitigação de contenção mínima com o risco registrado.
- **Débito** (médio e baixo): registre em `correcoes.md` com prazo e, se o projeto tiver lista de tarefas, lá também.
- **Risco aceito:** motivo, mitigação existente, **dono** (quem responde) e **data de revisão**. Crítico nunca; alto só com mitigação já aplicada e prazo curto. A decisão é do usuário, via `AskUserQuestion`.

## 3. Reteste

Quem corrige não verifica: depois que a skill `bug` devolve, peça ao `auditor-seguranca` (modo auditoria, etapa **reteste**) para repetir **a mesma Prova** de cada achado corrigido, no mesmo ambiente em que foi confirmado, e registrar o resultado. Ainda falha → o achado reabre e o bug volta à correção. Com autorização para produção, confira lá também, de forma passiva.

## Modelo de `correcoes.md`

```markdown
# Correções: <alvo>

- **Críticos e altos fechados**: <pendente | sim (<data>) | não se aplica — <motivo>>

| Achado | Severidade | Destino | Bug | Reteste | Situação |
|---|---|---|---|---|---|
| SEC-001 | crítico | corrigir | `.specs/bugs/seg-001-.../` | <data: passou> | fechado |
| SEC-004 | médio | débito até <data> | — | — | aberto (débito) |
| SEC-006 | baixo | risco aceito | — | — | aceito (ver relatório) |

## Credenciais trocadas
| Credencial (sem valor) | Onde estava | Trocada em | Por quem | Antiga revogada |
|---|---|---|---|---|

## Reaberturas
- <SEC-NNN: o que o reteste mostrou, data>
```
