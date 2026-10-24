# Etapa 2a: Pesquisa

Reunir **evidências** para julgar a ideia com honestidade. A pesquisa existe para **desafiar** a ideia tanto quanto para apoiá-la. Ela coleta e cita; não decide nem desenha solução.

## Despachar o `pesquisador`

Envie ao agente `pesquisador`:

- a ideia em uma frase e o tipo (de `ideia.md`);
- as hipóteses e as dúvidas iniciais;
- as lentes abaixo, pedindo que pule as que não se aplicam.

Lentes:

1. **Usuários e demanda**: quem tem esse problema e quão forte é o sinal? Separe o que as pessoas dizem querer do que fazem de fato.
2. **O que já existe**: produtos concorrentes, alternativas gratuitas ou open source, tentativas anteriores que deram certo ou errado, e por quê.
3. **Mercado e contexto**: como as pessoas resolvem isso hoje, tendências, custo de não fazer nada.
4. **Dados e restrições**: volumes, limites de plataforma, exigências legais (ex.: LGPD), dependências de terceiros.
5. **Evidências contra**: as razões mais fortes para não construir.

## Escrever `.specs/produto/pesquisa.md`

Use o retorno do agente. Não acrescente afirmações sem fonte; se precisar, marque `PREMISSA`.

```markdown
# Pesquisa: <título curto>

- **Data**: <AAAA-MM-DD>
- **Confiança geral nas evidências**: alta | média | baixa

## Usuários e demanda

- <achado> — [fonte: <url> | PREMISSA] (confiança: alta/média/baixa)

## O que já existe

- <concorrente, alternativa ou tentativa anterior> — <o que aconteceu, por que importa> — [fonte]

## Mercado e contexto

- <como resolvem hoje, custo de não fazer nada> — [fonte]

## Dados e restrições

- <volume, limite, exigência legal> — [fonte]

## Evidências contra a ideia

- <razão forte para não construir> — [fonte]
  (Seção obrigatória. Se nada foi encontrado, escreva isso e o que foi procurado.)

## Lacunas

- [A ESCLARECER: ...]

## Fontes

- <url sem credenciais>
```
