# Dependências e infraestrutura (fase 7)

Responde: **do que isso depende, e quanto custa mantê-lo de pé?** Vulnerabilidades conhecidas já estão na fase 6: aqui só se aponta para ela.

## 1. Levantar (sem instalar nada novo)

Do `inventario.md` da avaliação, dos manifestos e lockfiles da cópia e do `execucao.md`:

- **Bibliotecas diretas**: nome, versão usada (lockfile), declarada (manifesto).
- **Runtime e plataforma**: linguagem e versão, framework principal, banco, sistema operacional da imagem.
- **Serviços externos**: pagamento, e-mail, armazenamento, mapas, autenticação, IA, monitoramento; pelos SDKs, pelas variáveis de ambiente (só os **nomes**) e pela configuração de implantação.
- **Contas necessárias**: nuvem, registros de pacote privados, chaves de API, domínio, lojas de aplicativo. Em nome de quem estão? São transferíveis?
- **Infraestrutura**: onde roda hoje (arquivos de implantação, IaC), o que exige (filas, cache, tarefas agendadas), backup.

No ambiente isolado, se as dependências já estiverem instaladas, comandos de leitura do gerenciador ajudam: `npm outdated`, `pip list --outdated`, `bundle outdated`, `go list -m -u all`, `cargo outdated` (se instalado). Saída em `evidencias/`.

## 2. Pesquisar (`pesquisador`, em paralelo)

Rode `date` e passe a data da consulta. Um `pesquisador` para as bibliotecas diretas (em lotes, se forem muitas) e outro para runtime, serviços e preços:

```
Para cada item: versão usada <X>; versão atual; data da última versão publicada;
situação (ativo | só manutenção | descontinuado | arquivado | substituído por <Y>);
fim de suporte da versão usada (para runtime e framework: endoflife.date ou página oficial).
Para cada serviço pago: plano necessário no volume <de avaliacao.md>, preço com a data,
limites do plano gratuito, como exportar os dados e sair.
Fonte primária e data em cada linha; sem fonte, PREMISSA. Inclua evidências contra.
```

## 3. Avaliar

| Pergunta | Sinal de problema |
|---|---|
| Biblioteca abandonada? | sem versão há mais de 2 anos, repositório arquivado, aviso de descontinuada no registro |
| Versão antiga? | duas ou mais versões principais atrás; atualizar exige reescrever (estime) |
| Runtime em fim de suporte? | já passou, ou passa nos próximos 12 meses: atualizar é custo certo |
| Dependência única e crítica? | uma biblioteca pequena de uma pessoa no caminho principal (cruze com a fase 8) |
| Serviço pago? | custo mensal no volume esperado; reajuste; cobrança por uso sem teto |
| Bloqueio por fornecedor? | API proprietária sem equivalente, dados sem exportação, formato fechado; quanto custaria sair |
| Conta não transferível? | chave, domínio ou loja em nome de pessoa física do vendedor |

**Custo mensal de rodar**: some infraestrutura e serviços no volume esperado, cada parcela com fonte e data, ou `estimativa`. Fatura real do vendedor (se entregue) vence a estimativa.

## Modelo de `dependencias.md`

```markdown
# Dependências e infraestrutura: <slug>

- **Data da consulta**: <AAAA-MM-DD> · **Runtime**: <linguagem e versão> — fim de suporte <data> (<fonte>)
- **Custo mensal de rodar**: <valor ou faixa> (<real | estimativa>) no volume <...>

## Bibliotecas diretas
| Biblioteca | Usada | Atual | Última versão em | Situação | Fonte |
|---|---|---|---|---|---|

## Serviços e contas
| Serviço | Para quê | Plano e custo (data) | Conta em nome de | Como sair |
|---|---|---|---|---|

## Bloqueio por fornecedor
- <dependência> — <o que prende> — custo de sair: <estimativa | não quantificável>

## Vulnerabilidades
Ver `seguranca.md` (fase 6).
```

Cada problema vira linha em `achados.md` (biblioteca abandonada no caminho principal: `condição` ou `custo`; runtime vencido: `custo`; conta não transferível: `condição`).
