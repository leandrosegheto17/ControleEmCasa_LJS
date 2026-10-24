# As 9 fases da investigação de incidente

Princípio: **conter e restaurar primeiro, investigar depois.** Desenho original: `.rascunho/FLUXO-INCIDENTE.md`.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Detecção e triagem | O que está acontecendo e qual a gravidade? | `incidente.md` (triagem) | Sintoma, início, quem é afetado, alcance e impacto registrados; severidade P0–P3 justificada; segurança e dado pessoal avaliados; veredito | o da sessão |
| 2 | Contenção | Como paro o dano agora? | `incidente.md` (evidências, ações) | Evidências copiadas; cada ação confirmada, com hora, como desfazer e resultado; `Contido: sim` | o da sessão |
| 3 | Restauração | O serviço voltou ao normal? | `incidente.md` (restauração) | Sinal da triagem normal por métrica, pelo período combinado; `Estável: sim` | o da sessão |
| 4 | Linha do tempo | O que aconteceu e em que ordem? | `linha-do-tempo.md` | Eventos com hora e fonte, do gatilho à restauração; lacunas marcadas; evidências preservadas | Opus (leitura em Haiku) |
| 5 | Causa raiz | Por que aconteceu de verdade? | `causa-raiz.md` | Hipóteses testadas contra evidência; 5 porquês até causa sistêmica; fatores contribuintes; sem culpa; `Causa confirmada: sim` | Opus |
| 6 | Correção definitiva | Como elimino a causa? | `.specs/bugs/<slug>/` (ou feature), entrada em `.specs/liberacao.md`, `correcao.md` | PASS do verificador; suíte verde na checagem final; no ar e confirmada pelo sinal da fase 3 | Sonnet |
| 7 | Prevenção | Como evito que volte e detecto mais cedo? | `prevencao.md` | Ao menos uma ação de prevenção e uma de detecção (ou motivo); cada uma com responsável e prazo; recorrência checada | Opus |
| 8 | Post-mortem | O que aprendemos? | `postmortem.md` | Sem culpa; resumo, impacto, linha do tempo, causa, o que funcionou e o que não, ações; `Status: final` | Sonnet |
| 9 | Comunicação | Quem precisa saber? | `comunicacao.md`, `Encerrado: sim` no `incidente.md` | Comunicados enviados ou dispensados com motivo; LGPD avaliada por humano quando houver dado pessoal | Sonnet |

## Aprovação nas fases urgentes

Mesmo formato seguir / ajustar / parar, com rótulos que falam a língua da emergência:

- Fim da 1: **seguir para a contenção com <severidade> (Recomendado)** · ajustar a severidade ou o alcance · não é incidente (encerrar e oferecer `bug`).
- Fim da 2: **contido, seguir para a restauração (Recomendado)** · não contido, tentar outra medida · parar.
- Fim da 3: **estável, seguir para a linha do tempo (Recomendado)** · observar mais tempo · parar (incidente fica aberto).

Se a medida de contenção já restaurou o serviço (ex.: reversão), a fase 3 só confirma por métrica.

## Modelo de `correcao.md` (fase 6)

```markdown
# Correção definitiva: <id>

- **Tipo**: código (bug <slug>) | comportamento novo (feature <nome>) | configuração ou infraestrutura | causa externa (sem correção aqui)
- **Verificação**: `validation.md` PASS em <pasta> | checagem automatizada `<arquivo>` | não se aplica (<motivo>)
- **Checagem final**: <N passaram, 0 falharam> · **Integração**: <merge local | PR <link> | branch mantida>
- **Liberação**: <entrada de <data> em .specs/liberacao.md | implantacao.md>
- **Correção emergencial da fase 3**: <nenhuma | substituída | levada à branch principal em <commit>>
- **Em produção**: pendente | sim, confirmado em <data> por <sinal da fase 3>
```

## Laços comuns

- Triagem diz "não é incidente" → `Encerrado: sim` com o motivo; skill `bug` se houver defeito.
- Contenção não funcionou → outra medida do menu; 2 medidas sem efeito ou dano crescente: escalar (quem mais precisa entrar, registrado no `incidente.md`).
- Restauração instável (volta e cai) → de volta à fase 2.
- Indício de invasão ou vazamento em qualquer fase → caminho de segurança da skill antes de seguir.
- Hipótese sem evidência → não é causa; nova hipótese, uma por vez. Evidência expirou → registre a lacuna, não preencha com suposição.
- A skill `bug` não reproduz → instrumentar em produção (log ou métrica temporária, liberação confirmada) e voltar à fase 5.
- Monitoramento acusou problema na liberação da correção → reverter (skill `liberacao`) e voltar à fase 5.
- Mesma causa raiz em 2 incidentes ou mais → a prevenção é de processo ou de arquitetura (refatoração, skill `refatoracao`), não só um teste.
- Post-mortem com nome de pessoa como causa → reescrever pela condição que permitiu o erro.
