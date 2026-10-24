# Ferramenta, onde mora e como se testa (fase 4)

Responde: **qual o meio mais simples e mantido que serve?** Simples ganha: menos peças, menos para manter, menos para quebrar.

## A escada (do mais simples ao mais caro)

Suba só quando o degrau de baixo não atende o escopo de `processo.md`, e anote por que cada degrau descartado não serve.

| Degrau | Exemplos | Quando serve |
|---|---|---|
| 0 Recurso nativo | regra de e-mail, filtro, fórmula ou automação da planilha, regra do banco, recurso do sistema que já se usa | O sistema de origem já faz, só falta ligar |
| 1 Agendador do sistema | Agendador de Tarefas do Windows, `cron`, `systemd timer`, agendamento do CI (GitHub Actions `schedule`) rodando um comando que já existe | O passo é um comando conhecido que só precisa rodar sozinho |
| 2 Script curto | Python, PowerShell, shell, na linguagem que o usuário ou o projeto já usa, com teste | Juntar, transformar, conferir, mover dados entre lugares acessíveis |
| 3 Serviço de automação pronto | plataforma de integração sem código, automação do próprio fornecedor | Ligar serviços na nuvem que já conversam por conectores; quem mantém o conector é o serviço |
| 4 Código no projeto | função, tarefa em segundo plano ou comando dentro de um sistema existente | A automação mexe nos dados ou nas regras daquele sistema |
| 5 Agente de IA | modelo de linguagem decidindo ou redigindo dentro da automação | Só quando há texto livre a interpretar ou redigir e regra fixa não resolve; nunca para decidir sozinho ação irreversível |

**Automação do Claude Code** (hook, comando, skill, agendamento do próprio Claude Code) é outro eixo: veja [claude-code.md](claude-code.md).

### Agente de IA: quando e com que travas

Entra só com o motivo escrito ("o e-mail chega em texto livre e precisa virar campos"). Travas obrigatórias, que vão para o `desenho.md`: saída validada por regra (formato, faixa, campos) antes de agir; ação irreversível só com aprovação humana; teto de custo e de chamadas por execução; limite de iterações (laço de agente sem limite não termina quando a tarefa é impossível); registro da entrada e da saída do modelo, sem dado pessoal desnecessário; casos de teste com respostas ruins do modelo (vazia, fora do formato, inventada). Detalhes do Claude como modelo: skill `claude-api`.

## Escolher entre alternativas

- **Uma opção óbvia** no degrau certo (o projeto já usa, o usuário já tem conta, só existe uma que serve): registre em **Ferramenta** com o motivo; sem `escolha-tecnologia`.
- **Alternativas reais** (dois serviços prontos, script contra serviço, agendador local contra CI): skill `escolha-tecnologia`, modo **enxuto** recomendado (automação costuma ser fácil de trocar); contrato em [composicao.md](composicao.md). Se a ferramenta guardar dados ou fluxos que não se exportam bem, o modo sugerido passa a rigoroso.
- Conta, assinatura ou plano pago: ação externa do usuário, com confirmação.

## Onde mora

Pergunte via `AskUserQuestion`, recomendando pelo caso:

- **No projeto existente** (recomendado quando a automação lê ou altera dados e regras de um sistema que já existe): construção pela `feature` ou `legado`.
- **Num repositório de automações do usuário** (recomendado para script avulso e hook pessoal): repositório git com uma pasta por automação, suíte de testes e CI comuns; se ainda não existe, criá-lo é a primeira tarefa da fase 6 (com `.specs/projeto/testes.json`).
- **Num repositório próprio da automação**: quando ela é grande ou tem dono diferente.
- **No serviço pronto**: a configuração mora lá; o que for código mora num dos repositórios acima. Exporte a configuração (se o serviço permitir) para o repositório, como versão.

Pasta solta sem git não é opção: automação é código, precisa de versão.

**Mudança da pasta de trabalho**: se a sessão começou em outro repositório, copie `.specs/automacoes/<slug>/` para o repositório de **Onde mora** ao fim desta fase e grave no original **Resultado** `movida para <caminho>`. Dali em diante, a sessão trabalha no destino.

## Como se testa

Decida aqui, para a fase 5 escrever critérios testáveis:

- **Código** (degraus 2, 4, 5, scripts de hook): suíte do repositório; dependências externas simuladas; dado real só em cópia; `testes.json` com o comando, para a trava.
- **Agendador** (degrau 1): o comando agendado tem teste; o agendamento em si é conferido na fase 8 (rodou na hora, alerta de "não rodou" testado).
- **Recurso nativo e serviço pronto** (degraus 0 e 3): casos de teste com entrada e resultado esperado, executados no modo de teste do serviço ou em dados de cópia, registrados em `execucao.md`. Sem teste automatizado possível, registre em **Como se testa** o motivo; qualquer pedaço de código embutido segue a regra de código.
