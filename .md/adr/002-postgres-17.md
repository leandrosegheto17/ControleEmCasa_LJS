# ADR-002: Postgres 17 em local, CI e produção (diverge do Postgres 16 do padrão)

- **Status:** Substituído pelo ADR-016 em 2026-10-27 (antes: Aceito em 2026-10-24, etapa 0 aprovada; escolha do usuário na análise, P6)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)

## Contexto

- O Padrão LJS pede `docker-compose.yml` com Postgres 16.
- O Neon cria projetos novos em Postgres 17 por padrão (`PREMISSA`: conferir na criação do projeto, etapa 17).
- Rodar local e CI numa versão diferente da produção esconde diferenças de comportamento, por exemplo em planos de consulta, funções e `pg_dump`/`pg_restore` entre versões.
- O legado já tinha migrado os testes para Postgres 17 pelo mesmo motivo (decisão D4 da refatoração do MyMoney).

## Decisão

1. **Postgres 17** no `docker-compose.yml`, no serviço Postgres do `ci.yml` e no projeto Neon.
2. O `pg_dump` do `backup.yml` e do `deploy.yml` usa o cliente da mesma versão principal do servidor.
3. Uma checagem no CI compara a versão principal do compose com a do serviço do CI.

## Consequências

**Positivas**
- Local, CI e produção na mesma versão: o que passa no CI passa em produção.
- O backup e a restauração usam ferramentas da mesma versão.

**Negativas**
- Diverge do texto do padrão. Os outros dois apps precisam decidir o mesmo; a recomendação é seguir este ADR.
- Se o Neon mudar a versão padrão, este ADR precisa ser revisto. A versão fica fixada na criação do projeto.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Postgres 16 em tudo, criando o Neon em 16 | Possível, mas fica numa versão mais antiga sem ganho. Escolha do usuário: 17 |
| 16 local e 17 no Neon | Paridade quebrada; exatamente o risco que se quer evitar |
