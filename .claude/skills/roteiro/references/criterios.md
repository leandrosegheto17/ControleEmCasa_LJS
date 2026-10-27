# Critérios para quebrar em features

## Fatia vertical

Uma feature está bem fatiada quando, ao terminar:

- alguém consegue **usar** o que ela entrega, do começo ao fim (dado, regra, tela ou API);
- há **critério de aceite testável** de ponta a ponta, não só testes de camada;
- ela pode ser **integrada e liberada** sozinha sem deixar o produto quebrado;
- o que falta nas outras features não a impede de funcionar.

## Anti-padrões

| Quebra ruim | Por quê | Alternativa |
|---|---|---|
| "Banco", "API", "Front" como features | Ninguém usa nada até a última terminar; o risco de integração vem no fim | Cada feature atravessa as camadas para um fluxo de valor |
| Uma feature "Geral" com tudo | `tasks.md` de 170 tarefas, sem ponto de aprovação no meio | Divida por fluxo de valor |
| Features por tela | Telas sem regra ou regras sem tela | Feche um fluxo completo por vez |
| Feature de "melhorias" ou "ajustes" | Sem critério de pronto | Distribua nas features a que pertencem |

## Ordem

1. O que **destrava** os outros (fundação, conta e acesso, isolamento de dados).
2. O que tem a **maior incerteza** técnica ou de negócio (descobrir cedo que não dá é barato).
3. O que o usuário **mais valoriza**, depois do que destrava.
4. Cobrança, notificações e extras por último, salvo se forem o negócio.

## Tamanho

**Não se limita a quantidade de tarefas de uma feature.** O que se limita é o tamanho de cada **tarefa**: a menor possível, com meta de até 2 horas de trabalho humano, cada uma com a linha **Estimativa** (regra de Tarefas do `CLAUDE.md`).

A feature tem tamanho **relativo** (P, M, G), pelo esforço total: a soma das estimativas das tarefas quando já existirem, ou uma conta de cabeça antes disso. Ela deve ser grande o bastante para entregar valor e pequena o bastante para ser **validada e liberada como uma unidade**. Sinais de que precisa dividir: não cabe em uma frase de valor, ou o primeiro resultado utilizável só aparece depois de muitas semanas.

## Quando **não** dividir

- Escopo de um fluxo de valor só, mesmo que tenha muitas telas.
- Projeto pessoal pequeno (fluxo 2) que o tlc classifica como Small ou Medium.
- Divisão que só cria burocracia: se duas features sempre seriam integradas juntas, são uma.
