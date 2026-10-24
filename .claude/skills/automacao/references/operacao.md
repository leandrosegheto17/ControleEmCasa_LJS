# Operação e manutenção (fases 8 e 9)

## Operação (fase 8)

Responde: **como saberei se falhar?** Usa o que o usuário e o projeto já têm para avisar (e-mail, mensagem, painel, monitoramento existente); instalar ferramenta ou contratar serviço é decisão do usuário.

### Ligar

1. **Checagem final** quando há código: `python .claude/scripts/trava-testes.py --rodar` na versão que vai operar; com falha, não liga.
2. **Implantar**, se houver o que pôr no ar: skill `implantacao` (ferramenta pessoal) ou `liberacao` (produção com usuários), com os itens de [composicao.md](composicao.md).
3. **Agendar ou ligar a ordem de executar** é ação que age sozinha: confirme via `AskUserQuestion` dizendo exatamente o que passa a acontecer (o quê, quando, com que credencial, teto, como pausar). Registre o comando ou a tela usada, sem credencial.
4. Primeira execução sozinha acompanhada: confira o relatório e o efeito.

### O que precisa existir

| Item | O que decidir | Testado como |
|---|---|---|
| **Alerta de falha** | erro, falha parcial e teto atingido avisam por um canal que alguém lê, com o que olhar e o que fazer | provocar uma falha (entrada inválida, credencial de teste errada, teto temporário baixo) e ver o aviso chegar |
| **Alerta de "não rodou"** | verificação fora da automação (o agendador, o CI ou um serviço de sinal de vida) avisa se o relatório não chegou no prazo | pular uma execução (pausa) e ver o aviso chegar |
| **Relatório** | resumo de cada execução (seção 12 de `desenho.md`), onde chega, quem lê, com que frequência | duas execuções reais com relatório recebido |
| **Pausa** | o jeito único de parar (seção 14), documentado onde o dono acha | ligar a pausa, ver a execução seguinte não agir, desligar |
| **Dono** | pessoa (ou papel) que recebe os alertas, decide pausar e responde pela automação; substituto nas ausências | — |
| **Teto em produção** | valores finais do limite de ação em massa e de custo | — |

**Alerta nunca disparado não conta.** Falha silenciosa é o pior caso: sem os dois alertas testados, a fase não passa.

Em produção com usuários, a automação ganha entrada no `.specs/runbook.md` (formato da skill `incidente`): como saber se o problema é dela, como pausar, o que fica pela metade e como completar ou desfazer.

## Manutenção (fase 9)

Responde: **continua funcionando quando algo muda?**

- **Documentação**, no lugar de **Onde mora** (README da pasta da automação, ou contexto do projeto nas seções do modelo de `documentar/references/contexto-ia.md`): o que faz e o que não faz; como funciona (gatilho, passos, dependências, só os nomes das variáveis); como simular; **como pausar e como desligar de vez**; quem é o dono; onde chegam relatório e alertas.
- **Gatilhos de revisão**, com quem avisa: o sistema de origem, a API ou o formato da entrada mudou; o processo mudou; o volume mudou muito; credencial vai expirar; alerta repetido.
- **Revisão periódica** (sugestão: trimestral, ou na expiração da credencial): ainda roda, ainda é usada, a conta de retorno ainda fecha, os alertas ainda chegam. A decisão é **manter / ajustar / aposentar**; aposentar é desligar o agendamento, revogar a credencial e anotar.
- **Inventário**: em projeto existente, a automação entra no `inventario.md`.

Com a documentação feita, a revisão agendada e o dono confirmado, marque a fase 9 `feita` e **Resultado** `concluída (<data>)` em `processo.md`.

## Modelo de `operacao.md`

```markdown
# Operação: <processo>

- **Ligada em**: <AAAA-MM-DD> · **Versão**: <commit ou tag | configuração exportada em <data>>
- **Gatilho**: <agenda ou evento> · **Onde roda**: <...>
- **Dono**: <...> · **Substituto**: <...>
- **Implantação**: <— | .specs/implantacao.md | .specs/liberacao.md (<data>)>

## Alertas e relatório

| Item | Canal | Vai para | Disparo testado |
|---|---|---|---|
| Falha | | | <AAAA-MM-DD> |
| Não rodou | | | <AAAA-MM-DD> |
| Relatório | | | <AAAA-MM-DD> |

## Pausa e desligamento

- **Pausar**: <como> · testada em <AAAA-MM-DD>
- **Desligar de vez**: <desligar agendamento, revogar credencial, o que mais>
- **Tetos em produção**: <ação: N por execução · custo: R$ N por mês>

## Manutenção

- **Documentação**: <caminho>
- **Gatilhos de revisão**: <...>
- **Próxima revisão**: <AAAA-MM-DD> · **Responsável**: <...>

## Histórico

- <AAAA-MM-DD: alerta real, pausa, mudança, revisão feita, decisão>
```
