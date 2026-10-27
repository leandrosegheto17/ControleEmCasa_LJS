# ADR-016: Postgres 18 em local, CI e produção (substitui o ADR-002)

- **Status:** Aceito em 2026-10-27 (decisão do usuário na etapa 17)
- **Data:** 2026-10-27
- **Decisores:** Leandro (stakeholder)
- **Substitui:** ADR-002 (Postgres 17)

## Contexto

- O ADR-002 fixou o Postgres 17 em local, CI e produção, contando que o Neon criaria o projeto em 17.
- Na etapa 17 o projeto Neon de produção (`controle-em-casa`) **nasceu em Postgres 18**, e a versão maior de um projeto
  Neon não pode ser baixada depois de criada.
- O `pg_dump` recusa servidor de versão maior mais nova que a dele. O backup diário e o dump antes de cada deploy usam
  o cliente fixado por digest e conferem a versão maior do servidor antes de rodar (ADR-015): com o cliente 17, o
  backup de um Neon 18 falharia sempre.
- O motivo do ADR-002 continua valendo: local, CI e produção na mesma versão maior, para que o que passa no CI passe em
  produção e para que o backup e a restauração usem ferramentas da mesma versão.

## Decisão

1. **Postgres 18** no `docker-compose.yml`, nos serviços Postgres do `ci.yml` (jobs `banco` e `e2e-pilha`) e no projeto
   Neon.
2. O `pg_dump`/`psql` do `backup.yml` e do `deploy.yml` (action `dump-cifrado`) usa a imagem `postgres:18-alpine`
   fixada por digest; a versão maior do servidor é conferida antes e precisa ser 18.
3. No `docker-compose.yml`, o volume é montado em `/var/lib/postgresql`: nas imagens oficiais do 18 o `PGDATA` passou a
   ser `/var/lib/postgresql/18/docker` e o volume declarado pela imagem é o diretório pai.
4. Em vez de recriar o Neon em 17, o projeto inteiro sobe para o 18.

## Consequências

**Positivas**
- A paridade do ADR-002 volta a valer com a versão que a produção de fato tem.
- O backup consegue ler o Neon de produção.

**Negativas**
- O volume local antigo (17) não serve para o 18: quem tinha o banco local precisa de `docker compose down -v` e subir
  de novo (os dados locais são de teste).
- Atualizar a imagem do dump continua exigindo trocar tag e digest juntos (G-40).
- Os outros dois apps LJS precisam decidir o mesmo; a recomendação é seguir este ADR.

## Alternativas consideradas

| Alternativa                             | Por que não                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Recriar o projeto Neon em Postgres 17   | Possível, mas o usuário preferiu manter o projeto criado e subir o resto para o 18 |
| Neon em 18, local e CI em 17            | Paridade quebrada, e o `pg_dump` 17 não lê o servidor 18: o backup falharia        |
| Cliente 18 só no backup, resto em 17    | Paridade quebrada entre CI e produção; o risco que o ADR-002 queria evitar         |
