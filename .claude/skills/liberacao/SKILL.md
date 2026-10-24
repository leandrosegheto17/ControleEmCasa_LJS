---
name: liberacao
description: Coloca uma mudança em produção com segurança e volta fácil — checagem final de testes, plano de liberação (feature flag, liberação gradual, janela), staging com teste de fumaça quando existir, pausa obrigatória antes de produção, monitoramento e reversão testada — registrando em .specs/liberacao.md. Use na fase 11 do projeto novo, na fase 8 do legado, ou para qualquer liberação em produção com usuários. Não use para ferramenta pessoal (isso é a skill implantacao).
---

# Liberação

Responde: **como colocar no ar sem susto, e como voltar em minutos se algo der errado?**

## Pré-requisitos

- Validação aprovada (`validation.md` com PASS; `seguranca.md` sem achado crítico ou alto em aberto, quando exigido).
- Mudança integrada na branch de liberação.
- **Checagem final de testes** nessa branch: `python .claude/scripts/trava-testes.py --rodar`. Com falha, não libere.
- **Validações pendentes** marcadas como condição para lançamento (`decisao.md`, no projeto novo) concluídas.
- Saber como o projeto faz deploy (do `inventario.md`, `arqueologia.md`, CI ou scripts). Se não houver mecanismo de deploy, montá-lo é a primeira tarefa (para algo simples, a skill `implantacao` ajuda).

## 1. Plano de liberação

Monte e apresente:

| Item | Decisão |
|---|---|
| **Estratégia** | feature flag desligada e ligada aos poucos · liberação gradual por grupo de usuários ou porcentagem · tudo de uma vez numa janela de baixo uso |
| **Staging** | existe? (pergunte via `AskUserQuestion` se não estiver registrado) · sem staging: flag desligada em produção, liberação para um grupo pequeno primeiro |
| **Monitoramento** | o que observar: erros, tempo de resposta, métrica de negócio da feature, logs; onde ver; por quanto tempo |
| **Critério de parada** | o que faz voltar atrás (ex.: erros acima do normal, reclamação de usuário, métrica caindo) |
| **Reversão** | como desligar a flag ou voltar à versão anterior, e quanto tempo leva; **testada antes** |
| **Dados** | migração de banco? é reversível? backup antes |
| **Comunicação** | quem precisa saber antes e depois (usuários, cliente, equipe) |

Preferir sempre a estratégia mais reversível disponível. Pergunte via `AskUserQuestion`: **aprovar o plano / ajustar / parar**.

## 2. Staging (se existir)

Implante em staging, rode o teste de fumaça (fluxo principal da mudança e fluxos vizinhos) e, se a mudança mexe em dados, teste a migração e a reversão ali.

## 3. Produção

**Pausa obrigatória.** Publicar em produção é ação externa: confirme via `AskUserQuestion` dizendo exatamente o que será feito (versão, estratégia, como voltar).

1. Backup dos dados, se houver migração.
2. Deploy pelo mecanismo do projeto.
3. Teste de fumaça em produção.
4. Ligar aos poucos (flag ou grupo), observando o monitoramento a cada passo. Cada aumento de alcance é uma confirmação nova.
5. Atingiu o critério de parada? Reverta na hora e avise.

## 4. Registrar

Acrescente uma entrada em `.specs/liberacao.md`:

```markdown
## <AAAA-MM-DD> — <mudança> (<versão ou commit>)

- **Suíte**: <N passaram, 0 falharam> · **Segurança**: <ok | achados aceitos>
- **Estratégia**: <flag | gradual | janela> · **Staging**: <sim, ok | não>
- **Alcance**: <ex.: 10% → 50% → 100%, com datas>
- **Monitoramento**: <o que foi observado e resultado>
- **Reversão**: `<como>` · testada em <data>
- **Resultado**: liberada | revertida (<motivo>)
```

## Ao terminar

Responda com o resultado, o alcance atual, o que monitorar nos próximos dias e como reverter. Pergunte via `AskUserQuestion`: **concluir / ampliar o alcance / reverter**.

## Regras

- Nunca publique em produção sem confirmação específica, nem amplie o alcance sem nova confirmação.
- Segredos nunca no repositório nem no `liberacao.md`.
- Tudo em português.
