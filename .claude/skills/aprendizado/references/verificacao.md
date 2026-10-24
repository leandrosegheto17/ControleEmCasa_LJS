# Verificação (fase 6): aprendi de verdade?

A sessão avalia; **não ensina durante a avaliação**. Nenhuma resposta, dica ou correção até o fim das três partes: o que faltou vai para lacunas, e a explicação vem depois do resultado, se o usuário quiser.

## 1. Refazer sem consulta

- Escolha da parte, via `AskUserQuestion`: **a fatia com mais ajuda (Recomendado)** (código mostrado ou degrau 4 ou 5 no diário), a fatia do maior risco da fase 2, outra à escolha do usuário.
- O usuário refaz numa pasta ou arquivo novo dentro da pasta do veículo (ex.: `refazer/`), **sem documentação, sem o código anterior aberto e sem a IA**. Combine um tempo (ex.: 30 minutos).
- No fim, a sessão lê o que ele fez e roda, se der. Registre o que saiu, onde travou e quanto tempo levou. Travar não reprova: mostra a lacuna.

## 2. Explicar como se ensinasse

O usuário escreve (em "Other" ou num arquivo `explicacao.md` na pasta do veículo) uma explicação curta de como o veículo funciona e por que foi feito assim, para alguém que conhece programação mas não esta tecnologia. A sessão lê e anota: o que está certo, o que está vago, o que está errado.

## 3. Perguntas por objetivo

Para cada `O-N` de `plano.md`, uma a três perguntas, uma por vez, ligadas ao **Como vou provar**:

- **Por quê** de uma escolha no código dele.
- **E se**: uma variação que ele não fez ("e se o token vier no cabeçalho errado?").
- **Transferência**: o mesmo conceito noutro contexto.
- **Análise de erro**: um trecho com um defeito plantado.

Sem dica depois da pergunta. Resposta errada é anotada, não corrigida na hora.

## Avaliação

| Situação | Quando |
|---|---|
| `atingido` | refez ou respondeu sem ajuda, explicou o porquê, transferiu para um caso novo |
| `parcial` | faz com consulta ou sem transferir; explica o quê, mas não o porquê |
| `não atingido` | não consegue fazer nem explicar sem ajuda |

Cada avaliação cita a evidência (o que ele fez ou disse). **Resultado**: `objetivos atingidos` (todos atingidos), `parcial` (algum parcial), `não atingidos` (algum não atingido).

Depois do resultado, ofereça explicar as lacunas (agora sim, ensinando) e pergunte, via `AskUserQuestion`: **seguir para o registro (Recomendado se atingidos)**, **ajustar: fatia de reforço na fase 5** (Recomendado se parcial ou não atingido, dentro do prazo; acrescente a fatia ao diário como `planejada` e volte o **Resultado** para `pendente`; depois repete só a verificação do objetivo que faltou, numa seção nova), **parar**.

## Modelo de `verificacao.md`

```markdown
# Verificação: <tema>

- **Data**: <AAAA-MM-DD> · **Resultado**: <pendente | objetivos atingidos | parcial | não atingidos>

## Refazer sem consulta

- **Parte**: <fatia e motivo da escolha> · **Tempo**: <combinado / real>
- **O que saiu**: <...> · **Onde travou**: <...>

## Explicação como se ensinasse

- **Certo**: <...> · **Vago**: <...> · **Errado**: <...>

## Objetivos

| Objetivo | Situação | Evidência | Lacuna |
|---|---|---|---|
| O-1 | atingido · parcial · não atingido | <o que fez ou disse> | <...> |
```
