# Registro (fase 9)

Responde: **o que aprendemos?** O próximo que mexer neste trecho precisa saber onde estava o gargalo, o que foi feito, quanto rendeu e até onde o sistema aguenta agora.

1. **Resumo em `performance.md`:** acrescente a seção abaixo e preencha **Resultado**: `concluída` (meta atingida), `meta parcial — <motivo>` ou `parada — <motivo>`.
2. **Contexto do projeto** (`CLAUDE.md` ou equivalente, nas seções de `.claude/skills/documentar/references/contexto-ia.md`; crie um mínimo se não existir): a armadilha descoberta e a regra para não voltar (ex.: "listagens carregam relações em lote, nunca consulta dentro do laço"; "toda consulta nova em tabela grande passa por `EXPLAIN`"), o comando da medição e onde fica a guarda. Mostre o diff ao usuário.
3. **Inventário:** atualize `.specs/projeto/inventario.md` se entrou peça reutilizável (camada de cache, utilitário de lote, roteiro de carga) ou ferramenta nova.
4. **Oportunidades restantes:** gargalos menores do diagnóstico, opções não feitas e tarefas `não feita — meta atingida` vão para `.specs/projeto/dividas.md` (modelo da skill `refatoracao`, `references/motivo.md`), com tipo `desempenho`, a medida e a pontuação.
5. **Chamado por outro fluxo:** responda ao chamador com o caminho da pasta, os números antes e depois e o commit integrado, e registre o retorno em **Usar em**.

```markdown
## Registro
- **Gargalo**: <causa, com a fração do tempo> — `diagnostico.md`, rodada <N>
- **Correção**: <mudanças mantidas, com commit> · **Revertidas**: <mudanças sem ganho confirmado e por quê>
- **Números**: <métrica> antes <valor> → depois <valor> (alvo <valor>), mesmo roteiro `carga/<arquivo>`, <ambiente>
- **Guardas**: <erro, memória, CPU, custo antes e depois>
- **Limite atual**: <até quanto aguenta no cenário (ex.: 180 req/s com p95 < 300 ms) e o próximo recurso a saturar> | <não medido — motivo>
- **Guarda em vigor**: `guarda.md` · **Produção**: <número depois da liberação | não se aplica>
- **Lições**: <o que surpreendeu; o suspeito óbvio que não era>
```

Peça a aprovação final.
