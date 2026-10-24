# Verificação (fase 7)

Responde: **funciona de verdade e sem vazar nada?** Vem depois do PASS do `verificador` e da revisão curta da skill `feature`/`legado` (que provam a spec contra o simulado), e da auditoria restrita ([composicao.md](composicao.md)).

## 1. Ponta a ponta no sandbox

- **Ação externa**: confirmação específica via `AskUserQuestion`, dizendo o que roda, contra qual conta de sandbox e se gera custo.
- Rode os testes de sandbox (comando documentado na fase 6) e um roteiro manual curto na aplicação subida localmente ou em staging: fluxo principal, um erro de negócio (ex.: cartão de teste recusado), um webhook real do sandbox chegando ao nosso endpoint (túnel ou staging; expor a máquina local é ação externa).
- Compare com `contrato.md`: divergência nova vai para lá e, se crítica, abre a saída de emergência.
- Sem sandbox: `dispensado — <motivo>`, com o risco levado ao plano de liberação (alcance inicial mínimo, menor operação real possível com confirmação).

## 2. Segredos e logs

- `python .claude/scripts/varredura-seguranca.py ferramentas` (segredos no código e no histórico), se a auditoria ainda não rodou no mesmo commit.
- Procure no diff da branch: chave, token ou URL com credencial; variável de ambiente lida fora da configuração; chave de produção em teste ou exemplo.
- Rode o ponta a ponta com o log no nível usado em produção e leia o que saiu: nenhum dado pessoal, número de cartão, token ou corpo completo de resposta com dado sensível. Mensagem de erro mostrada ao usuário sem detalhe interno do fornecedor.

## 3. Limites e custo

- Pico de `terceiro.md` contra o limite de taxa de `contrato.md`: o limitador do nosso lado está abaixo do dele.
- Custo mensal estimado no volume esperado, com a fonte do preço e a data; dentro do orçamento.
- Teto de custo do nosso lado configurado e testado (fase 6); alerta de orçamento no painel do fornecedor, se houver (configurar é do usuário).

## 4. Achados da auditoria

Críticos e altos corrigidos como tarefa da feature (fase 6) e retestados pelo `auditor-seguranca` com a mesma Prova; médios e baixos com destino (corrigir agora, débito com prazo, risco aceito pelo usuário).

## Modelo de `verificacao.md`

```markdown
# Verificação: <fornecedor> — <caso de uso>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash>
- **Feature**: `.specs/features/integracao-<slug>/validation.md` — <PASS> · **Revisão**: <sem bloqueio>
- **Auditoria**: `.specs/seguranca/<id>/` — crítico <N> · alto <N> · médio <N> · baixo <N>

## Ponta a ponta no sandbox

- **Confirmado em**: <AAAA-MM-DD> · **Comando**: `<...>` · **Resultado**: <N passaram, N falharam>
- **Roteiro manual**: <fluxo principal ok · erro de negócio ok · webhook ok>
- **Divergências novas**: <nenhuma | C-NN em contrato.md>

## Segredos e logs

- <varredura: OK | achados> · <diff: limpo | ...> · <log de produção: limpo | ...>

## Limites e custo

- **Pico/limite**: <N/s contra N/s> · **Custo estimado**: <valor/mês> — <fonte (data)> · **Teto**: <valor, testado>

## Achados

| SEC-NNN | Severidade | Destino | Tarefa | Reteste |
|---|---|---|---|---|

- **Pronto para produção**: <sim (AAAA-MM-DD) | não — <o que falta>>
```
