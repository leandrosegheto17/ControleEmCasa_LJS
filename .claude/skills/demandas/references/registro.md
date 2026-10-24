# Formatos do registro de demandas

## IDs

- **Demanda**: `DEM-NNN`, sequencial no projeto, nunca reaproveitado. A pasta é `DEM-NNN-<slug>`; o ID não muda se o título mudar.
- **Pessoa**: `PES-NNN`, sequencial em `contatos.md`. A mesma pessoa mantém o ID em todas as demandas dela.
- Duas branches criando demandas ao mesmo tempo podem gerar o mesmo número: ao integrar, a mais nova é renumerada (pasta e linha) e o **Histórico** registra o número antigo.

## Tipos

| Tipo | Quem pede | Fluxo dono | Arquivo do fluxo |
|---|---|---|---|
| `sugestão` | usuário, cliente, parceiro, equipe, sem poder de decidir | 10, skill `sugestao` | `sugestao.md` |
| `solicitação` | quem decide e cobra (cliente contratante, dono do produto, gestor) | 11, skill `solicitacao` | `solicitacao.md` |
| `suporte` | quem usa e traz um problema, dúvida ou reclamação | 32, skill `suporte` | `suporte.md` (e a base comum `base-conhecimento.md`, na raiz de `.specs/demandas/`) |

O tipo diz **como a demanda entrou**. O que ela **vira** (bug, feature, redesign...) é o destino do encaminhamento, registrado em **Ligação**. Um caso de suporte que traz uma ideia gera uma demanda nova do tipo `sugestão` com **Originada de** apontando para ele. Tipo trocado na triagem (ex.: "sugestão" de quem é cliente contratante e cobra prazo) muda com uma linha no **Histórico**.

## Situações

| Situação | Quer dizer | Vai para |
|---|---|---|
| `recebida` | registrada, ainda sem análise | `em análise` |
| `em análise` | o fluxo dono está trabalhando nela | qualquer uma abaixo |
| `aguardando autor` | perguntas enviadas; **Revisitar em** = prazo de espera | `em análise`, `fechada — sem resposta do autor` |
| `em observação` | sem decisão de fazer; **Revisitar em** = data ou gatilho (ex.: "3 interessados") | `em análise` |
| `planejada` | aceita para depois; ainda sem trabalho aberto | `encaminhada` |
| `encaminhada` | trabalho aberto em **Ligação** | `entregue`, `em análise` (o destino devolveu) |
| `entregue` | o trabalho ligado terminou; falta confirmar com o autor | `fechada — resolvida`, `em análise` (não resolveu) |
| `fechada — <desfecho>` | `resolvida` · `recusada` · `duplicada de DEM-NNN` · `já atendida` · `sem resposta do autor` · `desistência do autor` · `parada — <motivo>` | — |

**Em andamento** = situação que não começa com `fechada`. "Não resolveu" depois da entrega vira demanda nova com **Originada de**, para não reescrever o histórico da primeira.

## Modelo de `.specs/demandas/registro.md`

```markdown
# Registro de demandas

- **Objetivo do produto**: <uma frase> (fonte: `.specs/produto/decisao.md` | `plano-comercial.md` | usuário em <AAAA-MM-DD>)
- **Atualizado em**: <AAAA-MM-DD>

| ID | Tipo | Título | Situação | Desde | Canal | Autor | Interessados | Ligação | Revisitar em |
|---|---|---|---|---|---|---|---|---|---|
| DEM-001 | sugestão | <título> | em análise | <data> | e-mail | PES-003 (cliente) | 2 | — | — |
```

Uma linha por demanda, em ordem de ID; a linha muda junto com `demanda.md`. **Interessados** é a contagem (autor fora); os IDs ficam na demanda.

## Modelo de `.specs/demandas/DEM-NNN-<slug>/demanda.md`

```markdown
# DEM-NNN: <o que a pessoa quer, do ponto de vista dela>

- **Tipo**: <sugestão | solicitação | suporte> · **Fluxo**: <skill `sugestao` (10) | skill `solicitacao` (11) | skill `suporte` (32)>
- **Situação**: <...> · **Desde**: <AAAA-MM-DD> · **Revisitar em**: <— | data | gatilho>
- **Recebida em**: <AAAA-MM-DD> · **Canal**: <e-mail | conversa | formulário | reunião | rede social | ferramenta de suporte | interno> · **Fonte**: <colado | link (host, aberto ou recusado) | relato do usuário>
- **Autor**: PES-NNN (<papel>) · **Contato em**: <contatos.md local | <ferramenta externa> | sem contato (anônimo)>
- **Interessados**: <— | PES-NNN (DEM-NNN, data), ...>
- **Originada de**: <— | DEM-NNN>
- **Ligação**: <— | `<pasta do trabalho>` (skill `<nome>`) · encaminhada em <data>>

## Palavras do autor

> <texto literal; dado pessoal de terceiros, contatos e segredos trocados por [removido: <tipo>]>

## Contexto

- <onde estava, o que fazia, versão, plano ou tela — só o que veio com a demanda>
- **Anexos**: <— | `evidencias/<arquivo>` (fora do git)>

## Também pedido por

| Data | Autor | Demanda | Palavras |
|---|---|---|---|

## Histórico

| Data | Situação | Motivo |
|---|---|---|
| <data> | recebida | registrada por <sessão / usuário> |

## Comunicações

| Data | Para | Tipo | Canal | Enviado por | Resumo |
|---|---|---|---|---|---|
```

## Modelo de `.specs/demandas/contatos.md` (fora do git)

```markdown
# Contatos dos autores (fora do git; não copiar para outro arquivo)

| Pessoa | Nome | Contato | Canal preferido | Consentiu novo contato? | Demandas abertas | Desde |
|---|---|---|---|---|---|---|
| PES-001 | <nome> | <e-mail ou telefone> | <canal> | <não | sim (<data>, como)> | DEM-004 | <data> |
```

- **Finalidade**: responder sobre a demanda. Guardar só enquanto houver demanda aberta da pessoa, ou com consentimento registrado para novos contatos (ex.: convite para testar). Ao fechar a última demanda, ofereça apagar a linha (Recomendado sem consentimento).
- A pessoa pode pedir para ver, corrigir ou apagar os dados dela: atenda e registre na demanda, sem o dado. Prazos e base legal pela LGPD ficam `PREMISSA` até o agente `pesquisador` conferir; não é parecer jurídico.
- Projeto com ferramenta de suporte ou CRM: o contato fica lá e **Contato em** aponta para ela (sem link com credencial); `contatos.md` guarda só o `PES-NNN` e a referência.
- Sem `contatos.md` na máquina (outra máquina, arquivo perdido): a demanda segue, e o aviso passa a "eu envio" com o canal que o usuário tiver.

## `.gitignore`

```
.specs/demandas/contatos.md
.specs/demandas/*/evidencias/
```
