# Execução, acompanhamento, aceite e entrega (fases 6 a 9)

## Fase 6: execução

1. **Encaminhar** pela skill `demandas`: `encaminhamento.md` com o objetivo (seção Problema), os `CA-NN` do escopo do acordo em **Critérios de aceite** (texto confirmado, com os IDs), **Não pode mudar** e o adiado em **Fora de escopo**, regras de negócio e checagens da triagem em **Evidência e restrições**, e a linha **Decisão** apontando para o acordo (versão e data). Depois o artefato de entrada do destino e a **Ligação**; situação `encaminhada`.
2. **No destino `feature` ou `legado`**: o Specify parte de `encaminhamento.md`. Os `CA-NN` **já estão confirmados**: o Specify os traduz em EARS citando o `CA-NN` de origem em cada critério e pergunta só o técnico (dimensões implícitas). Dúvida que mudaria um `CA-NN`, o escopo ou o prazo volta para cá (fase 7, desvio). Assim o esclarecimento não é feito duas vezes.
3. **Outros destinos** (`bug`, `redesign`, `integracao-terceiros`, `performance`...): pelo formato de entrada de cada um (mapa da skill `demandas`); os `CA-NN` vão como critério de correção ou meta.
4. **Fase 6 feita** quando o artefato de fim do destino existe e cada `CA-NN` do escopo se liga a um critério com PASS em `validation.md` (ou ao critério de correção do `bug`). `CA-NN` sem ligação é desvio de escopo: avise (fase 7) antes do aceite.

## Fase 7: acompanhamento

Corre junto com a 6. Objetivo: **sem surpresas** para o solicitante.

- **Marcos**: ao retomar a solicitação (ou quando o destino fechar a fase ligada a um marco), confira **Próximo marco**. Venceu ou chegou: atualização curta (modelo "atualização" em [mensagens.md](mensagens.md)) com o que ficou pronto, o que vem e se o prazo se mantém. Envio com confirmação (**Avisar**); **Próximo marco** passa ao seguinte.
- **Desvio, avisado cedo**: assim que aparece (estimativa do reconhecimento ou da arqueologia maior que a da fase 4, spike com resposta ruim, verificação falhando mais de uma vez, dependência atrasada, `CA-NN` que não cabe), **não espere o próximo marco**. Mensagem "desvio" com o que aconteceu, o efeito no prazo ou no escopo e 2 opções (ex.: manter o prazo cortando um `CA-NN` desejável; manter o escopo com nova data). A escolha do solicitante, por escrito, vira nova versão do acordo (fase 5).
- **Pedido novo no meio do caminho**: nova demanda (`demandas`, **Registrar**, **Originada de** esta), com resposta ao solicitante dizendo que ela será estimada à parte; esta entrega não muda sem renegociação.
- Cada atualização ou desvio vira uma linha na seção Acompanhamento e em Comunicações.

```markdown
## Acompanhamento

| Data | Marco ou desvio | Situação do destino | Prazo | Enviado | Resposta |
|---|---|---|---|---|---|
| <data> | spec pronta | `feature`, fase 2 | mantido | <data, canal> | — |
```

## Fase 8: aceite

Começa quando a `demandas` acha o artefato de fim do destino (situação `entregue`).

1. **Preparar a demonstração** como o acordo combinou, **antes de liberar para todos**: staging, ambiente local, ou produção com flag ligada só para o solicitante (skill `liberacao`, se for o caso). Roteiro: um passo por `CA-NN`, com dados de exemplo (nunca dados reais de outro cliente).
2. **Convite** (modelo "aceite" em [mensagens.md](mensagens.md)), com confirmação de envio. A demonstração pode ser feita junto (reunião) ou pelo próprio solicitante seguindo o roteiro; em ambos os casos o resultado volta por escrito.
3. **Resultado por `CA-NN`**: atende · não atende · atende com observação.
4. **O que o solicitante pedir a mais**, classificado com ele:

| Caso | Quando | O que fazer |
|---|---|---|
| **Critério não atendido** | um `CA-NN` combinado não se comporta como escrito | defeito: skill `bug` (vindo de demanda, o `CA-NN` como comportamento esperado); volta à fase 8 depois |
| **Ajuste pequeno** | dentro do combinado, não muda nenhum `CA-NN` nem o prazo, cabe em P (até 1 dia): texto, rótulo, ordem, mensagem | entra: `feature` com pasta `<slug>-ajuste-N` partindo da lista de ajustes; registrado no Aceite |
| **Mudança de escopo** | comportamento novo, `CA-NN` diferente do confirmado, ou mais que um ajuste pequeno | **nova demanda** (`DEM-NNN` nova, **Originada de** esta), fases 1 a 5 dela; esta pode ser aceita sem ela |

5. **Aceite registrado**: "aceito" por escrito (ou "aceito com os ajustes X, Y"), com data, canal e trecho. Sem aceite escrito, a fase não fecha; laço "solicitante não responde" em `fases.md`.

```markdown
## Aceite

- **Demonstração**: <data, onde, quem> · **Roteiro**: <arquivo ou "abaixo">
- | `CA-NN` | Resultado | Observação |
- **Ajustes**: <— | item → `feature` `<pasta>` | `bug` `<pasta>`>
- **Novas demandas**: <— | DEM-NNN (o quê)>
- **Aceite por escrito**: <pendente | <data>, <canal>, "<trecho>">
```

## Fase 9: entrega e fechamento

1. **No ar**: se o destino já liberou (o `legado` faz a `liberacao` na fase 8 dele), confira a entrada em `.specs/liberacao.md`; senão, acione a skill `liberacao` (produto com usuários) ou `implantacao` (ferramenta pessoal). Liberar é ação externa, com a confirmação dessas skills. Integrado não é liberado.
2. **Documentação e contexto**: a `feature` e o `legado` atualizam o contexto do projeto na integração; confira se foi feito e se a documentação de uso (README, `docs/`, ajuda) cobre o que mudou para quem usa. Faltou: corrija na mesma linha de trabalho do destino (com teste se mudar comportamento).
3. **Comunicado** (modelo "entrega" da skill `demandas`, mais o que ficou adiado e os IDs das demandas novas), com confirmação, também aos **Interessados**.
4. **Registro** na seção Entrega e no **Aprendizado**: esforço e prazo estimados × reais; `CA-NN` que mudaram depois de confirmados e por quê. Diferença grande calibra as próximas estimativas.
5. **Fechar**: situação `fechada — resolvida` (`demandas`); aviso de fechamento, com confirmação. Sem outra demanda aberta do solicitante e sem consentimento para novo contato, ofereça apagar a linha em `contatos.md`.

```markdown
## Entrega

- **No ar em**: <data> · **Liberação**: <entrada em `.specs/liberacao.md` | `.specs/implantacao.md`>
- **Entregue**: <CA-NN> · **Adiado**: <CA-NN → DEM-NNN>
- **Contexto e documentação**: <atualizados (onde) | sem mudança — motivo>
- **Comunicado**: <data, canal, para quem>
```
