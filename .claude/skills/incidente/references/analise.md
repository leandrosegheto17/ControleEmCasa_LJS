# Linha do tempo e causa raiz (fases 4 e 5)

Só com o sistema estável. Tudo que entra aqui tem fonte; o que não tem fica como lacuna, nunca como suposição.

## Linha do tempo (fase 4)

### Fontes

- **Ações e comunicações** já registradas no `incidente.md`.
- **Logs, métricas, traces e alertas** do intervalo, inclusive antes do primeiro sinal (o gatilho costuma vir minutos ou horas antes).
- **Mudanças**: liberações (`.specs/liberacao.md`, histórico do CI), configuração, migrações, dependências, serviços de terceiros (página de status).
- **Código**, pelo `leitor-codigo`: `git log --since/--until` no intervalo; `git log -S<símbolo>` ou `-G<regex>` para achar quando um trecho apareceu; `git blame -L` nas linhas suspeitas; o PR e a tarefa ligados ao commit. A mensagem de commit é a **alegação** do autor sobre a intenção: confira com o diff e prefira a descrição do PR.

### Como montar

- Um fuso só, declarado no topo. Horários exatos; aproximado leva `~`.
- Um evento por linha, cada um com a fonte.
- Marque os marcos: **gatilho**, **início do impacto**, **detecção**, **contenção**, **restauração**. Deles saem os tempos até detectar, conter e restaurar.
- **Lacunas**: intervalo sem evidência fica escrito como lacuna. Evidência que ainda vai expirar: copie agora.

### Modelo de `linha-do-tempo.md`

```markdown
# Linha do tempo: <id>

- **Fuso**: <UTC | America/Sao_Paulo>
- **Tempos**: gatilho → detecção <min> · detecção → contenção <min> · contenção → restauração <min> · impacto total <min>

| Hora | Evento | Marco | Fonte |
|---|---|---|---|
| 14:23 | Liberação v2.3.4 concluída | gatilho | `.specs/liberacao.md`, CI #812 |
| 14:31 | Alerta: taxa de erro > 5% | detecção | painel <nome> |

## Lacunas

- <intervalo>: <o que falta e por quê (log expirou, sem métrica)>
```

## Causa raiz (fase 5)

Siga as fases 1 a 3 do `systematic-debugging` (investigação, padrão, hipótese), com este roteiro:

- **Hipóteses**: liste todas as plausíveis pela linha do tempo. Para cada uma: o que a confirmaria, o que a descartaria, e o resultado. Uma por vez; sem evidência, não é causa.
- **Gatilho × causa**: o gatilho é o que disparou (a liberação, o pico); a causa raiz é a condição que deixou o gatilho virar incidente. Corrigir só o gatilho não evita o próximo.
- **5 porquês**: a partir do sintoma, pergunte "por quê" com uma evidência em cada resposta, até chegar a algo do **sistema ou do processo** (falta de teste, de alerta, de limite, de revisão, de documentação, de staging parecido com produção).
- **Fatores contribuintes**: o que piorou ou atrasou (alerta com limite alto, reversão lenta, painel que não existia).
- **Sem culpa**: "o que permitiu isso?", não "quem fez isso?". Pessoa nunca é causa; a condição que deixou o erro passar é.
- **Erros silenciosos**: `catch` vazio, valor padrão no erro, nova tentativa sem aviso costumam esconder a origem (lista na skill `bug`, `references/causa.md`).
- **Segurança**: incidente de segurança leva também o `auditor-seguranca` (vetor de entrada, alcance, o que mais está exposto).
- **Mesma causa antes?** Procure em `.specs/incidentes/*/causa-raiz.md` e `.specs/bugs/*/causa.md`.

Defeito de código confirmado aqui ainda será **reproduzido com teste** pela skill `bug` na fase 6; esta fase confirma pela evidência de produção.

### Modelo de `causa-raiz.md`

```markdown
# Causa raiz: <id>

- **Causa confirmada**: pendente | sim
- **Tipo de correção**: código | comportamento novo | configuração ou infraestrutura | causa externa
- **Correção em**: pendente | `.specs/bugs/<slug>/` | `.specs/features/<nome>/` | aqui mesmo (configuração) | não se aplica

## Hipóteses

| Hipótese | Confirmaria | Descartaria | Resultado |
|---|---|---|---|
| <...> | <...> | <...> | confirmada / descartada (<evidência>) |

## Gatilho

<o que disparou, com fonte>

## 5 porquês

1. Por que <sintoma>? → <resposta> (evidência: <...>)
2. Por que <...>? → <...> (evidência: <...>)
3. ...

## Causa raiz

- **Sistêmica**: <condição do sistema ou do processo>
- **Técnica**: `<arquivo:linha>` ou <configuração/componente> — <o que está errado>
- **Fatores contribuintes**: <...>
- **Recorrência**: <nenhuma | mesma causa em <ids ou slugs>>

## Critérios de aceite da correção

1. Dado <estado que levou ao incidente>, quando <gatilho>, então <comportamento correto>.
```

Os critérios de aceite viram o `relato.md` da skill `bug` na fase 6.
