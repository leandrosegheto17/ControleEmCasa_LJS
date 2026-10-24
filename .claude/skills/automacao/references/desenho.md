# Desenho seguro (fase 5)

Responde: **o que pode dar errado, e o que impede o estrago?** Cada seção abaixo vai para `desenho.md` resolvida ou como `não se aplica — motivo`. A ferramenta concreta (biblioteca, recurso do serviço) é a que já existe no projeto ou no serviço; peça nova só se nenhuma resolver.

## Seções obrigatórias

1. **Gatilho**: o que dispara (horário, chegada de arquivo ou e-mail, evento, comando manual) e com que frequência; o que acontece se dois disparos se sobrepõem (trava de execução única).
2. **Ações e reversibilidade**: tabela de tudo o que a automação faz fora dela mesma (ler, criar, alterar, apagar, enviar, pagar, publicar), cada uma marcada `reversível` ou `irreversível`, com o jeito de desfazer.
3. **Permissões mínimas**: credencial própria da automação (não a pessoal do usuário), só com os escopos das ações da tabela; leitura onde só lê; pasta, conta ou banco de teste separados.
4. **Segredos**: onde ficam (cofre, variável de ambiente, segredo do CI ou do serviço), como entram (pelo usuário, nunca pela conversa), rotação e o que nunca aparece no log.
5. **Simulação (obrigatória)**: o padrão é simular; agir exige ordem explícita (`--executar`, chave na configuração, aprovação). A simulação lê de verdade e mostra, item a item, o que faria, sem efeito nenhum fora dela. Ação sem simulação possível vai para a seção 9 com aprovação humana.
6. **Idempotência**: rodar duas vezes não duplica. Como se reconhece o que já foi feito (marca no item, registro de processados, chave de idempotência, conferir antes de criar).
7. **Falha parcial e retomada**: o que acontece se cair no meio (item 37 de 100); registro do progresso; retomada sem refazer o feito nem pular o pendente; transação quando o destino permite.
8. **Limite de ação em massa**: teto por execução para cada ação irreversível (ex.: no máximo 20 e-mails, 0 exclusões sem aprovação); acima do teto, para antes de agir e avisa. Teto também de custo (chamadas pagas, IA).
9. **Aprovação humana**: onde a pessoa aprova antes (julgamento, exceção, irreversível sem simulação, acima do teto) e como (lista para aprovar, mensagem com confirmar, rascunho em vez de envio).
10. **Exceções**: como cada exceção do escopo é detectada, separada do caminho comum (nunca forçada nele) e avisada a quem age, com o que precisa para resolver.
11. **Registro de cada ação**: o que foi feito, em qual item, quando, com que resultado; sem segredo e sem dado pessoal além do necessário; onde fica e por quanto tempo.
12. **Relatório da execução**: resumo enviado ou gravado a cada execução (processados, feitos, pulados, exceções, falhas, duração), inclusive quando não houve nada a fazer.
13. **Alerta de falha**: erro, falha parcial, teto atingido e **execução que não aconteceu** (verificação externa de "deu sinal de vida": o agendador ou outro serviço avisa se o relatório não chegou no prazo). Canal que alguém lê.
14. **Pausa**: um jeito único, documentado e reversível de parar sem apagar nada (desligar a tarefa agendada, chave na configuração, flag, arquivo `PAUSA`), que a automação confere antes de agir.
15. **Validação da entrada**: o que chega (arquivo, e-mail, resposta de API, saída de IA) é conferido antes de usar: formato, campos, faixas; entrada estranha vira exceção, nunca ação.
16. **Dados e LGPD**: dados pessoais que a automação toca, para onde vão, por quanto tempo ficam; se saem para um serviço novo, ver `integracao-terceiros/references/seguranca-legal.md`. Não é parecer jurídico.
17. **Dependências externas**: para cada serviço chamado, tempo limite, nova tentativa só em erro transitório e operação idempotente, e o que acontece quando ele está fora (ver `integracao-terceiros/references/desenho.md`).

## Critérios de aceite (EARS)

Ponto de partida da spec (fase 6); adapte ao caso e traduza para o vocabulário do processo. Cada critério ganha teste automatizado (código) ou caso de teste executado (serviço pronto).

| ID | Critério |
|---|---|
| AUT-01 | WHEN a automação roda sem a ordem de executar, THE automação SHALL listar o que faria item a item e SHALL NOT causar efeito fora dela. |
| AUT-02 | WHEN a mesma entrada é processada duas vezes, THE automação SHALL produzir o mesmo estado final, sem duplicar ações. |
| AUT-03 | IF uma execução falha no item N, THEN a próxima execução SHALL retomar do primeiro item não concluído, sem refazer os concluídos. |
| AUT-04 | IF o número de ações irreversíveis de uma execução passa do teto, THEN a automação SHALL parar antes da primeira ação e SHALL avisar o dono. |
| AUT-05 | WHEN um item cai numa exceção do escopo, THE automação SHALL separá-lo sem agir e SHALL avisar quem resolve, com os dados para agir. |
| AUT-06 | WHEN uma execução termina (com sucesso, parcial ou sem nada a fazer), THE automação SHALL registrar o relatório da execução. |
| AUT-07 | IF ocorre erro não tratado, THEN a automação SHALL avisar pelo canal de alerta e SHALL encerrar sem ação pela metade não registrada. |
| AUT-08 | WHILE a pausa está ligada, THE automação SHALL NOT executar nenhuma ação. |
| AUT-09 | IF a entrada não passa na validação, THEN a automação SHALL tratá-la como exceção e SHALL NOT agir sobre ela. |
| AUT-10 | THE automação SHALL NOT gravar segredo nem dado pessoal desnecessário em registro, relatório ou alerta. |
| AUT-11 | WHEN a saída de um agente de IA é usada, THE automação SHALL validá-la por regra antes de agir, e SHALL pedir aprovação humana antes de ação irreversível. (Só com IA.) |

O alerta de "não rodou" (seção 13) é conferido na fase 8, com disparo testado, porque depende do agendamento real.

## Testes (fase 6)

- Simulador ou cópia para cada sistema tocado; **a suíte nunca age em dado real**. Amostras reais entram sanitizadas, como dados de teste.
- Um teste por critério acima, e casos de amostra do processo com o resultado que a execução manual produziu (a comparação "igual ao manual").
- Relógio controlado quando houver horário ou prazo.

## Modelo de `desenho.md`

```markdown
# Desenho seguro: <processo>

- **Data**: <AAAA-MM-DD> · **Ferramenta**: <de processo.md>

## 1. Gatilho
## 2. Ações e reversibilidade

| Ação | Onde | Reversível? | Como desfazer | Teto por execução |
|---|---|---|---|---|

## 3. Permissões mínimas
(... uma seção por item da lista, até 17, com `não se aplica — motivo` quando couber)

## Critérios de aceite

| ID | Critério (EARS) | Como se testa |
|---|---|---|

## Riscos aceitos

- <risco, por que se aceita, quem aceitou, AAAA-MM-DD>
```
