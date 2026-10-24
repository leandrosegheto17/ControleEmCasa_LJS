---
name: implantacao
description: Coloca uma aplicação no ar com pouco esforço e volta fácil — local com Docker (docker compose, reinício automático, volume de dados, backup agendado) ou numa camada de nuvem gratuita (limites atuais conferidos, segredos fora do código) — e registra comandos, endereço, backup e como voltar em .specs/implantacao.md. Use na fase 8 do fluxo de uso próprio ou quando o usuário pedir para publicar uma aplicação pessoal. Não use para lançamento de produto vendido com staging e liberação gradual.
model: sonnet
effort: medium
---

# Implantação

Responde: **como colocar no ar com um comando, sem perder dados e com volta fácil?**

## Pré-requisitos

- `.specs/produto/necessidade.md` (onde roda, exposição, backup) e a validação aprovada (`validation.md` com PASS, restauração do backup testada).
- **Checagem final de testes:** com tudo commitado, rode `python .claude/scripts/trava-testes.py --rodar` na versão que será implantada e mostre o resultado. Com falha, não implante.
- Se `.specs/implantacao.md` existir, esta é uma reimplantação: leia-o, mostre a versão no ar e siga do passo 3.

## 1. Escolher o destino

Se `necessidade.md` disser "os dois" ou estiver em aberto, pergunte via `AskUserQuestion`: **local com Docker** ou **nuvem gratuita** (com o serviço candidato), explicando em cada descrição o custo, os limites e o que acontece com os dados.

## 2. Preparar

Leia [references/destinos.md](references/destinos.md) e siga a seção do destino escolhido. Em resumo:

- **Local com Docker**: `docker-compose.yml` com reinício automático, volume nomeado para os dados, variáveis num `.env` fora do git, e um serviço ou tarefa agendada de backup.
- **Nuvem gratuita**: peça ao `pesquisador` os **limites atuais** do serviço (não use valores de memória). Segredos nas variáveis do serviço, nunca no repositório. Backup dos dados para fora do serviço (eles podem pausar ou apagar projetos inativos).

Crie também um **script único de implantação** (`scripts/implantar.sh` ou `.ps1`, conforme o sistema do usuário) e o comando de volta à versão anterior.

## 3. Publicar

- **Local**: rode o script e confirme que a aplicação responde.
- **Nuvem**: publicar é ação externa. **Peça confirmação específica** via `AskUserQuestion` antes de rodar o comando que publica, dizendo o serviço e o que será enviado.

Depois de no ar:

1. Faça um teste de fumaça: abrir a aplicação, executar a ação principal, conferir que os dados persistem após reiniciar.
2. Rode o backup uma vez e confirme que o arquivo foi gerado no destino.

## 4. Registrar

Grave `.specs/implantacao.md`:

```markdown
# Implantação: <aplicação>

- **Data**: <AAAA-MM-DD> · **Versão**: <commit ou tag> · **Suíte**: <N passaram, 0 falharam>
- **Destino**: local com Docker | <serviço gratuito>
- **Endereço**: <url ou http://localhost:porta>
- **Implantar**: `<comando>`
- **Voltar à versão anterior**: `<comando>`
- **Backup**: <o quê, para onde, frequência> · último teste de restauração: <data>
- **Limites do plano** (nuvem): <...> — [fonte, data da consulta]
- **Segredos**: em <.env local | variáveis do serviço>; nunca no git

## Histórico

| Data | Versão | Observação |
|---|---|---|
```

## Ao terminar

Responda com o endereço, o comando de implantar e de voltar, e o resultado do teste de fumaça e do backup. Pergunte via `AskUserQuestion`: **seguir para uso e manutenção / ajustar / voltar à versão anterior**.

## Regras

- Nada de segredo no repositório nem no `implantacao.md`.
- Nunca publique na nuvem sem confirmação específica.
- Tudo em português.
