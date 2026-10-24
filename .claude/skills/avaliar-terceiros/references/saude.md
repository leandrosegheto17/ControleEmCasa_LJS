# Saúde e sustentabilidade (fase 8)

Responde: **dá para manter?** O histórico do git conta a história real: quem mexe, com que frequência, quando parou. Leia métricas **ao longo do tempo**, nunca um instantâneo.

## 1. Propriedade do código pelo git

Na cópia (precisa do histórico; sem `.git`, registre em **Não visto**):

```
python .claude/scripts/propriedade-git.py --repo <cópia> --saida .specs/avaliacoes/<slug>/evidencias
```

Opções: `--desde "3 years ago"` (histórico muito grande), `--sensiveis <regras.csv>` (linhas `padrão,etiqueta`, ex.: `**/pagamento/**,pagamento`; o padrão já cobre autenticação, criptografia e segredos), `--dias-parado 365`, `--ignorar-autor <regex>` (robôs além dos já ignorados). Só lê o histórico (`git log`, `git ls-files`): não executa código do terceiro.

O script grava `propriedade.json` (com e-mails, fica em `evidencias/`, fora do git) e `propriedade.md` (só nomes), e mostra:

| Medida | O que diz |
|---|---|
| **Fator ônibus** | menor número de pessoas que, somadas, fizeram mais da metade das mudanças nos arquivos que ainda existem. 1 = o projeto depende de uma pessoa. Também nos últimos 12 meses |
| Arquivos com um só autor | quanto do código só uma pessoa já tocou |
| Atividade por mês | commits nos últimos 24 meses: crescendo, estável, minguando ou parado |
| Pessoas | quem mais mexe, desde quando, e se ainda está ativa (último commit há até 180 dias) |
| Código sensível sem dono | arquivos de autenticação, criptografia, segredos (e etiquetas suas) com um só autor; **órfão** se, além disso, ninguém mexe há mais de `--dias-parado` dias |
| Donos ocultos | pessoa que concentra metade ou mais das mudanças de uma área sensível |

Complete com o `leitor-codigo` ou `git log`: ritmo de correções (`git log --oneline -i --grep=fix --since="12 months ago"`), tempo entre a introdução e a correção de bugs visíveis no histórico, pontos quentes (arquivos que mais mudam), e se os testes acompanham as mudanças.

No relatório, pessoas aparecem por **papel** (autor principal, segundo mantenedor), não por nome ou e-mail.

## 2. Saúde do projeto de origem (`pesquisador`)

Para projeto aberto, dependência ou o fornecedor do produto. Rode `date` e passe a data:

```
Saúde do <projeto | fornecedor> <nome>, consultada em <data>:
1. Versões publicadas nos últimos 24 meses (datas): ritmo, e se há versão de correção recente.
2. Issues e PRs: abertas versus fechadas ao longo do tempo; tempo até a primeira resposta numa amostra recente;
   PRs de fora esperando há meses.
3. Quem mantém: quantas pessoas ativas; empresa, fundação ou voluntário; financiamento (patrocínio, empresa por trás).
4. Mudanças recentes de dono, de licença ou de modelo de negócio.
5. Forks ativos ou alternativas compatíveis (saída se o projeto morrer).
6. Relatos de quem usa há 6 a 12 meses (retrospectivas, não anúncios de lançamento), com números de produção quando houver.
7. Fornecedor comercial: tempo de mercado, suporte oferecido (prazo, canal, período após a venda), sinais públicos de continuidade.
Cuidados: sinais do ecossistema com até 6 meses; confira se uma reclamação antiga ainda vale na versão atual;
afirmação de que algo "falhou" precisa de duas fontes; o rastreador de issues mostra a distância entre a documentação e a realidade.
Fonte e data em cada linha; sem fonte, PREMISSA. Inclua evidências contra. Não recomende.
```

Pergunta de fundo: **qual o risco de se arrepender disso em cinco anos?**

## 3. Documentação e transferência de conhecimento

- Da fase 4: quantos tropeços para rodar do zero; documentação existente atual ou desatualizada.
- Comprar ou herdar: o autor principal fica disponível depois? Por quanto tempo, a que custo? Está no contrato? Com fator ônibus 1, essa é quase sempre uma **condição**.

## 4. Custo de manter

Estime horas por mês, marcado `estimativa`, com a base: atualizações de dependências e de runtime (da fase 7), correções (ritmo do histórico), suporte aos usuários, aprendizado inicial da equipe (tropeços, tamanho, qualidade da fase 5). Faixa (mínimo e máximo) é melhor que um número só.

## Modelo de `saude.md`

```markdown
# Saúde e sustentabilidade: <slug>

- **Data**: <AAAA-MM-DD> · **Histórico analisado**: <N commits, de <data> a <data> | sem histórico>
- **Fator ônibus**: <N> (12 meses: <N>) · **Arquivos com um só autor**: <N%>
- **Atividade**: <crescendo | estável | minguando | parado desde <data>> — <commits por trimestre>
- **Mantenedores ativos**: <N> · **Por trás**: <empresa | fundação | voluntários | o vendedor>

## Propriedade (resumo de `evidencias/propriedade.md`)
- Código sensível sem dono: <N arquivos; os 3 principais> · órfão: <N>
- Donos ocultos: <área — papel, N%>

## Projeto de origem
| Sinal | Situação | Fonte (data) |
|---|---|---|

## Transferência de conhecimento
## Custo de manter
- <faixa> horas por mês (estimativa) — base: <...>
```

Fator ônibus 1 em código central, projeto parado ou mantenedor único sem transferência prevista viram linhas em `achados.md` (em geral `condição` ou `custo`; `impeditivo` se ferir um eliminatório como "projeto ativo").
