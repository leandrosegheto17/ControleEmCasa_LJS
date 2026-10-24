# Relatório e prevenção (fase 9)

O relatório é para quem decide, não só para quem corrige: começa pelo que importa em linguagem simples. Segredo nunca aparece por inteiro.

## Prevenção (obrigatória)

Cada item com **responsável e prazo**, ou o motivo de não fazer:

1. **Varredura no CI:** um passo que roda `python .claude/scripts/varredura-seguranca.py ferramentas --saida <pasta> --estrito` (ou as ferramentas equivalentes do projeto) a cada mudança, falhando com achado alto, crítico ou segredo novo. É mudança no repositório: mostre o diff, faça numa branch, rode a checagem final (`python .claude/scripts/trava-testes.py --rodar`) e integre como no fluxo de feature; push e PR com confirmação específica. Ferramenta que o CI não tem: `--pular` com o motivo, ou instalar no CI (decisão do usuário).
2. **Rotação de credenciais:** as trocadas na fase 8 e uma rotina para as demais (quais, de quanto em quanto tempo, quem faz).
3. **Revisão periódica:** data da próxima auditoria e gatilhos que antecipam (lançamento, nova integração, mudança em login ou permissões, dado sensível novo, dependência com falha crítica anunciada).
4. **Lições para o projeto:** armadilhas viram regra no contexto do projeto (`CLAUDE.md` ou equivalente, mostre o diff) e, se cabível, checagem automática (lint, teste de autorização por rota). Riscos aceitos e débitos entram no `.specs/runbook.md` quando afetarem a operação.
5. **Recorrência:** compare com auditorias anteriores em `.specs/seguranca/`. O mesmo tipo de falha de novo aponta falha de processo: proponha a prevenção estrutural (ex.: autorização centralizada, teste de autorização gerado para cada rota nova).

## Modelo de `relatorio.md`

```markdown
# Relatório de segurança: <alvo>

- **Status**: <rascunho | final (<data>) | parado — <motivo>>
- **Período**: <início> a <fim> · **Modo**: <completo | restrito — <recorte>> · **Chamado por**: <...>

## Resumo
<3 a 5 linhas para quem decide: o estado geral, o que era grave, o que foi feito, o que resta e o risco que fica>

| Severidade | Encontrados | Corrigidos e retestados | Débito | Risco aceito | Não confirmados |
|---|---|---|---|---|---|
| crítico | | | | | |
| alto | | | | | |
| médio | | | | | |
| baixo | | | | | |

## Escopo e limites
- **Auditado**: <alvo, caminhos, ambientes> · **Fora do escopo**: <...>
- **Não coberto**: <ferramentas não executadas, teste ativo dispensado, áreas não revisadas> — o que isso significa para o leitor

## Método
Modelo de ameaças (`ameacas.md`, STRIDE), varredura (`<ferramentas>`), revisão manual, teste ativo em <ambiente> (`<n>` sondas).

## Achados
| ID | Título | Severidade | Situação final | Onde está o detalhe |
|---|---|---|---|---|

## Riscos aceitos
| Achado | Motivo | Mitigação existente | Dono | Revisar em |
|---|---|---|---|---|

## Débitos
| Achado | Prazo | Responsável |
|---|---|---|

## Prevenção
| Ação | Tipo (CI, rotação, revisão, regra, estrutural) | Responsável | Prazo | Situação |
|---|---|---|---|---|

**Próxima auditoria**: <data> · **Gatilhos que antecipam**: <...>
```

Antes de `Status: final`, revise com o usuário (`AskUserQuestion`: seguir / ajustar / parar). Compartilhar o relatório fora do projeto (cliente, terceiro, publicação) é ação externa: confirmação específica, e só depois dos críticos e altos fechados.
