# Execução (fase 4)

Responde: **funciona do jeito que dizem?** Se ninguém além do autor consegue rodar, isso já é um achado. O método de instalar do zero é o da skill `documentar` ([execucao.md](../../documentar/references/execucao.md): seguir só o escrito, anotar cada tropeço, comparar com o CI e o `Dockerfile`), que é o da seção 1 da `arqueologia`. Aqui ele roda num **ambiente isolado**, porque o código é de fora.

## 1. Antes de executar: ler

Com o `leitor-codigo`, na cópia, procure o que roda sozinho ou sai do projeto:

- scripts de instalação e de ciclo de vida: `preinstall`/`postinstall`/`prepare` no `package.json`, `setup.py`, `build.rs`, `conftest.py`, `Makefile`, `Dockerfile`, ganchos (`.husky/`, `.pre-commit-config.yaml`), `.npmrc`/`pip.conf` apontando para registro estranho;
- download e execução (`curl ... | sh`, `eval`, binários versionados), código ofuscado ou minificado fora do que é gerado;
- leitura de variáveis de ambiente, de `~` (chaves, credenciais de nuvem, `.gitconfig`), envio para endereços externos, telemetria.

Achou algo suspeito: não execute; achado `impeditivo` até explicação (saída da `SKILL.md`). Telemetria ou chamada externa legítima: anote para cortar a rede ou configurar.

## 2. Ambiente isolado (confirmação específica)

Pergunte via `AskUserQuestion`, dizendo o que vai rodar e onde:

| Opção | Como | Quando |
|---|---|---|
| **Contêiner (Recomendado)** | Docker com a imagem oficial da linguagem; só a cópia montada (`-v <cópia>:/app`); nenhuma variável de ambiente do usuário, nenhuma pasta da casa montada; rede só para instalar as dependências, depois `--network none` para testes quando der | Docker instalado. Baixar imagem é instalar: entra na confirmação |
| Máquina virtual ou área descartável | VM, Windows Sandbox ou equivalente, sem pastas compartilhadas além da cópia | sem Docker, ou o sistema precisa de serviços que o contêiner não sobe bem |
| Não executar | fases 4 a 6 por leitura; tudo `não verificado em execução` | o usuário recusa o risco ou o ambiente não existe |

**Nunca** na máquina do usuário com o ambiente dele: o código teria acesso a tokens, chaves SSH, credenciais de nuvem e aos outros projetos. Se o usuário insistir, registre o risco aceito em `execucao.md`, rode com variáveis de ambiente limpas e sem credenciais carregadas, e só depois de a leitura do passo 1 não achar nada.

Segredos necessários para rodar (chave de API, banco): use **de teste**, criados para a avaliação, colocados pelo usuário num `.env` da cópia; nunca credencial real do usuário nem do vendedor. Serviço do terceiro (pagamento, e-mail, a API dele): só sandbox, com confirmação; nada contra o serviço hospedado dele.

Anote o ambiente em `execucao.md` (imagem e versão, comando de subida, rede, o que foi montado): as fases 5 e 6 rodam no mesmo.

## 3. Inventário

Acione a skill `inventario` com a **raiz na cópia** e saída em `.specs/avaliacoes/<slug>/inventario.md`, sem gravar `.specs/projeto/testes.json` (esse arquivo é do projeto do usuário e alimenta a trava de testes). O inventário mostra peças, integrações e o comando de testes que a execução vai usar.

## 4. Seguir o escrito

No ambiente isolado, na ordem do README e da documentação do vendedor: pré-requisitos, instalação, configuração, banco, testes, aplicação. Cada passo com comando, resultado e data; cada passo que falhou ou faltou é um **tropeço**, com o que resolveu e a fonte.

- Rode a suíte e anote o resultado (passaram, falharam, puladas). Falha não se corrige.
- Rode as ferramentas de licença que precisam das dependências instaladas (`legal.md`, passo 3) e complete `legal.md`.
- Suba a aplicação e confirme que responde.

## 5. Prometido × observado

Exercite os **fluxos principais** (os do **Bom resultado** em `avaliacao.md` e os que `alegacoes.md` promete), de ponta a ponta, com dados de teste. Para cada alegação: `confirmada` (como e onde), `refutada` (o que aconteceu) ou `não verificada` (por quê). Alegação de desempenho só conta medida no mesmo ambiente; sem medição, `não verificada`. Alegação refutada vira linha em `achados.md`.

Ao fim, remova o contêiner ou a área descartável e anote o que ficou (a cópia continua, para as fases seguintes).

## Modelo de `execucao.md`

```markdown
# Execução: <slug>

- **Data**: <AAAA-MM-DD> · **Commit da cópia**: <hash>
- **Ambiente**: <contêiner `<imagem:versão>`, rede <aberta só na instalação | nenhuma> | VM <...> | não executado — <motivo>> · **Risco aceito**: <nenhum | <...>>
- **Roda?** sim | parcialmente (<o quê>) | não (<bloqueio>)
- **Suíte**: `<comando>` → <N passaram, M falharam, K puladas> · **Aplicação**: `<comando>` → <endereço, resposta>
- **Leitura prévia**: <nada suspeito | <achado>, `arquivo:linha`>

## Passos
| # | Escrito em | Comando | Resultado | Tropeço? |
|---|---|---|---|---|

## Tropeços
- **<passo>** — escrito: <...> · aconteceu: <...> · resolveu: <...> · fonte: <...>

## Prometido × observado
| Alegação (de `alegacoes.md`) | Situação | Evidência |
|---|---|---|
| <...> | confirmada · refutada · não verificada | <comando, tela, requisição; ou motivo> |

## Não resolvido
- [A ESCLARECER: ...]
```
