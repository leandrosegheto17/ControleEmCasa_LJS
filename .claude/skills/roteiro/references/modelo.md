# Modelo do roteiro (`.specs/projeto/roadmap.md`)

O formato da tabela e o vocabulário da **Situação** são os da skill `progresso` ([roadmap.md dela](../../progresso/references/roadmap.md)). O roteiro acrescenta colunas que o `progresso.py` ignora, mas que a quebra precisa.

```markdown
# Roadmap

Roteiro aprovado em AAAA-MM-DD (decisão AD-NNN em `.specs/STATE.md`).

| # | Feature | Situação | Tamanho | Depende de | Requisitos | Entrega (o que o usuário vê) |
|---|---|---|---|---|---|---|
| 1 | `fundacao` | Concluída | M | n/a | FUN-01 a FUN-35 | Esqueleto no ar, CI verde, backup rodando |
| 2 | `conta-e-acesso` | Em andamento | G | 1 | ACE-01 a ACE-40 | Cadastro, login e sessão funcionando |
| 3 | `grupos-e-elenco` | Não começada | M | 2 | GRU-01 a GRU-22 | Criar grupo e cadastrar jogadores |
```

## Regras

- **Situação** só com `Concluída`, `Em andamento` ou `Não começada`. Mais de uma feature `Em andamento` só com motivo na coluna livre.
- **Tamanho** P, M ou G (critérios em [criterios.md](criterios.md)).
- **Depende de**: número da feature, ou `n/a`.
- **Requisitos**: a faixa de IDs da spec do MVP que a feature cobre; cada requisito aparece em uma única linha.
- **Entrega**: uma frase no ponto de vista do usuário, não da arquitetura.
- A **ordem das linhas é a ordem de construção**. Reordenar é decisão (`AD-NNN`).
- Linha nova entra `Não começada`; feature que saiu do plano de vez é removida (com o motivo no `AD-NNN`), não marcada.
