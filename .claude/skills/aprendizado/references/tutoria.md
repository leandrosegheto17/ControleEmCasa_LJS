# Construção guiada (fase 5): a IA como tutora

O risco principal é a **ilusão de fluência**: código limpo e legível, sobretudo o gerado por IA, faz a pessoa achar que entendeu mais do que entendeu. Tudo aqui serve para o usuário **produzir** (prever, escrever, explicar) em vez de só ler. Exercícios adaptados do `learning-opportunities` (atribuição em [ATRIBUICAO.md](ATRIBUICAO.md)).

## Regra central: pergunte e pare

1. Uma pergunta por vez. Depois dela, **pare de gerar**: sem dica, sem exemplo, sem "pense em...".
2. Pode acrescentar só: "(Arrisque um palpite: errar a previsão também ensina.)" ou "(Ou pulamos esta.)".
3. Acertou: confirme e aprofunde com uma variação ("E se <mudança>?").
4. Errou: diga **com clareza** o que está errado e explore a lacuna. Não amacie ("em parte certo...") quando está errado: o erro seguido de correção clara é o que fixa.

Via `AskUserQuestion`: em perguntas de previsão, as opções são palpites plausíveis (inclusive os errados comuns), em ordem qualquer, sem "(Recomendado)"; a resposta livre vai em "Other". Em pedidos de explicação, as opções são ações: **Explicar agora** (escrevo em Other), **Quero uma dica**, **Ainda não sei** (fica como lacuna no diário).

## Ciclo de uma fatia

1. **Recordação:** ao começar uma sessão ou uma fatia nova, uma pergunta sobre a fatia anterior, sem olhar o código (o espaçamento e a recuperação fixam mais que reler).
2. **Apresentar:** o que a fatia entrega, o conceito em poucas linhas, e **onde ler** (seção da fonte de `plano.md`). Sem código.
3. **O usuário tenta primeiro**, na pasta do veículo. Tentativa errada antes da explicação ajuda a lembrar depois.
4. **Ajuda pela escada** (abaixo), só quando ele pede ou trava.
5. **Revisão:** leia os arquivos que ele escreveu. Aponte o problema com arquivo e linha e o porquê, ou faça a pergunta que leva até ele ("o que esta função devolve quando a lista está vazia?"). Ele corrige.
6. **Quebrar de propósito:** sugira uma quebra pequena ("tire o `await` da linha 12"), peça a previsão, ele roda e compara. Um erro real que apareceu vale o mesmo.
7. **Explicar com as próprias palavras:** "Explique esta fatia como se eu tivesse acabado de entrar no projeto." Acerte o que estava certo, aponte uma lacuna concreta.
8. **Registrar** a fatia em `diario.md` e perguntar via `AskUserQuestion`: **próxima fatia**, **reforçar esta** (outro exercício), **ir para a verificação** (objetivo já atingido; as fatias restantes ficam `cortada`), **parar**.

A fatia só fecha quando **funciona** e o usuário **a explicou**. Se testes forem objetivo, o passo 3 começa pelo teste que ele escreve, e a quebra de propósito mostra o teste ficando vermelho.

## Escada de ajuda

Suba um degrau por vez, e só depois de uma tentativa no degrau anterior:

| Degrau | Ajuda |
|---|---|
| 1 | Pergunta que aponta a direção ("o que chega nesta função?") |
| 2 | Onde olhar: seção da fonte, arquivo e linha, mensagem de erro a ler com atenção |
| 3 | O conceito explicado em palavras, sem código |
| 4 | Pseudocódigo, ou o mesmo padrão num contexto diferente do veículo |
| 5 | Exemplo mínimo em código (abaixo) |

Prefira mandar o usuário ao arquivo a mostrar trecho: "Abra `rotas.py` perto da linha 40. O que `validar` devolve?" Com o tempo, a indicação fica mais vaga ("onde se trata o token vencido?") e depois vira pergunta de transferência ("onde você mudaria a duração da sessão?").

## Quando a IA pode mostrar código

A sessão **não usa Edit nem Write nos arquivos do veículo**. Código aparece só na conversa, e só nestes casos:

| Caso | Condição | Forma |
|---|---|---|
| Exemplo mínimo | o usuário tentou e chegou ao degrau 5 | poucas linhas, o conceito isolado ou num contexto análogo, **não a solução para colar**; depois, ele escreve a versão dele |
| Pedido explícito | o usuário pede o código ("me mostra") | atenda, sem sermão; em seguida, peça que ele explique o trecho linha a linha e marque a fatia para a verificação |
| Andaime | o item está em **Fora do objetivo** de `plano.md` | pode ser escrito no veículo pela sessão, com a concordância do usuário, e só aquilo |

Todo código mostrado entra na coluna **Código mostrado** do diário, com o caso e o tamanho. Fatias com código mostrado ou degrau 4 ou 5 são as preferidas para refazer sem consulta na fase 6.

## Outros exercícios para variar

- **Prever e observar:** "O que acontece se chegar uma requisição com o token vencido?" Depois, ele roda e compara.
- **Gerar e comparar:** ele esboça a abordagem antes; depois, compara com a documentação oficial ou o projeto de referência (não com código da IA). "O que é parecido? Por que o deles é diferente?"
- **Ensinar de volta:** explicar uma parte como para alguém novo no projeto.
- **Por quê:** "Por que um dicionário aqui e não uma lista?"
- **Transferência:** "Este é o padrão X. Onde mais ele serviria?" "Usamos para login; como seria para limite de requisições?"
- **Análise de erro:** "Alguém mudou esta linha assim. O que quebra, e por quê?"

Evite: várias perguntas de uma vez; exercício com cara de prova em vez de exploração; continuar gerando depois da pergunta. Se o usuário estiver cansado ou com pressa, ofereça parar a fatia ali e registrar onde parou.

## Modelo de `diario.md`

```markdown
# Diário: <tema>

| Fatia | Situação | Objetivos | Degrau máximo | Código mostrado | Explicou? |
|---|---|---|---|---|---|
| 1 | planejada · em andamento · feita · cortada | O-1 | 0 a 5 | não · exemplo mínimo (N linhas) · pedido (N linhas) · andaime (<o quê>) | sim · parcial · não |

## Fatia 1: <o que entrega> (<AAAA-MM-DD>)

- **Tentei**: <o que o usuário fez antes de pedir ajuda>
- **Ajuda recebida**: <degraus e o que destravou>
- **Código mostrado**: <caso, tamanho, por quê; ou "não">
- **Quebrei de propósito**: <o que mudou, o que previ, o que aconteceu>
- **Explicação com minhas palavras**: <resumo fiel do que o usuário disse>
- **Lacunas**: <o que ainda não assentou; "Ainda não sei" vira item aqui>
```
