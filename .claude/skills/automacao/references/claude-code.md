# Automação do próprio Claude Code

Hook, comando, skill, subagente e agendamento do Claude Code também são automação: seguem as mesmas 9 fases, com processo descrito, conta de retorno, simulação, teste e alerta. Muda a ferramenta (fase 4) e o jeito de simular e testar.

## Qual peça (fase 4)

| Peça | Serve para | Onde mora |
|---|---|---|
| **Hook** | Reação automática a evento do Claude Code (antes ou depois de uma ferramenta, ao enviar um pedido, ao parar, ao abrir a sessão): formatar, checar, bloquear, avisar | `settings.json` do projeto ou do usuário, chamando um script versionado |
| **Skill** ou **comando** | Roteiro repetido que o usuário chama (`/nome`) ou o Claude aciona pela descrição | `.claude/skills/<nome>/` do projeto ou do usuário |
| **Subagente** | Trabalho especializado com modelo e ferramentas fixos, em paralelo ou isolado | `.claude/agents/` |
| **Execução sem interface** | Claude chamado por script, agendador ou CI (`claude -p`), com ferramentas permitidas restritas | repositório da automação, como script |
| **Repetição ou agenda do Claude Code** | Rodar um pedido a cada intervalo na sessão (skill `loop`) ou em agenda na nuvem (skill `schedule`) | configuração do próprio recurso |

Antes de criar: o recurso existe na versão instalada e funciona como se pensa? Confira na documentação atual (agente `pesquisador`, ou o agente `claude-code-guide` da sessão), com data. A lista acima é ponto de partida, não fato conferido.

## Como configurar sem duplicar

- **Hooks, permissões e variáveis**: a skill `update-config` da sessão configura o `settings.json`. Esta skill decide o quê e por quê (processo, desenho, testes); a `update-config` escreve a configuração. Mudar `settings.json` é ação com confirmação específica, mostrando o diff.
- **Nesta pasta `.claude` do Rascunho** valem as regras de `.claude/rules/manutencao-claude.md`: `CLAUDE.md`, rules e `settings.json` só com texto proposto e aprovação do usuário.
- **Plugins de terceiros** (ex.: `hookify`, que cria regras de hook em arquivos Markdown): instalar é dependência nova e decisão do usuário (`/atualizacoes`). Aqui eles servem só de referência.

## Regra de hook bem escrita

1. **Comportamento indesejado nomeado**: o que acontece hoje que não deveria (o "processo atual" da fase 1), com exemplos reais de comando ou edição.
2. **Evento certo**: antes da ferramenta (para impedir), depois dela (para checar ou formatar), ao enviar pedido, ao parar (lista do que conferir antes de encerrar).
3. **Padrão específico**: nem largo demais (pega o que não devia), nem estreito demais (deixa passar variações). Escreva os exemplos que devem casar e os que não devem antes do padrão, e teste com eles.
4. **Avisar antes de bloquear**: comece em modo aviso (é a simulação desta peça) e só passe a bloquear depois da execução assistida sem falso positivo.
5. **Mensagem útil**: o que foi detectado, por que é problema, o que fazer no lugar.
6. **Desligar sem apagar**: um jeito de desativar a regra (chave, variável, comentário documentado), que é a pausa desta peça.
7. **Lento e frágil não entra**: hook roda em toda ocorrência do evento; tempo limite curto; falha do próprio script não pode travar a sessão em silêncio (avisa e deixa passar, ou bloqueia com mensagem clara, por decisão escrita em `desenho.md`).

## Simular, testar e assistir

- **Script do hook é código**: mora num repositório (o do projeto, ou o de automações do usuário), com testes que passam a entrada do evento (JSON de exemplo) e conferem a saída e o código de retorno, como os testes de `.claude/scripts/trava-testes.py` em `.claude/scripts/testes/`. Casos que devem e que não devem disparar.
- **Execução assistida** (fase 7): uma semana em modo aviso, anotando cada disparo como certo ou falso positivo em `execucao.md`; só depois bloquear.
- **Laço de agente** (repetir até concluir, como faz o plugin `ralph-loop`): sempre com **limite de iterações** e **critério de conclusão verificável** (testes passando, arquivo com conteúdo esperado), nunca "até ficar bom"; o agente não pode declarar a conclusão para sair do laço sem que ela seja verdade.
- **Agenda na nuvem ou sem interface** age sozinha: ferramentas permitidas no mínimo, teto de custo, relatório de cada execução e alerta de falha, como qualquer automação (fase 8). Ligar é ação com confirmação específica.
