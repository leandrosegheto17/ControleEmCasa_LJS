# Valor, custo e risco, priorização (fases 4 a 6)

Os números são **estimativas para comparar**, não verdades: arredonde, diga de onde veio cada um e marque `PREMISSA` o que é palpite. A decisão é do usuário; a sessão mostra a conta e recomenda.

## Fase 4: valor

### Entradas

- **Objetivo do produto**: do topo de `.specs/demandas/registro.md`; se faltar, de `.specs/produto/decisao.md`, `problema.md` ou `plano-comercial.md`; se não houver nada, pergunte ao usuário uma vez (via `AskUserQuestion`, com sugestão) e grave no registro.
- **Evidência**: autor e **Interessados**, demandas parecidas, casos de suporte, dados de uso, se o projeto tiver (sem coletar dado novo por conta própria).

### Os quatro números (RICE, parte de valor)

| Item | Pergunta | Escala |
|---|---|---|
| **Alcance** | quantas pessoas ou contas sentem essa dor por mês (ou trimestre)? | número, com fonte (interessados, uso, base de clientes) ou `PREMISSA` |
| **Impacto** | quanto muda para cada uma? | 3 enorme · 2 alto · 1 médio · 0,5 baixo · 0,25 mínimo |
| **Confiança** | quão seguros estamos de alcance e impacto? | 100% (dado medido) · 80% (várias fontes) · 50% (uma voz, palpite) |
| **Alinhamento** | serve ao objetivo do produto? qual parte? | sim / em parte / não — sugestão que não serve a objetivo nenhum é sinal para questionar, não para pontuar |

**Evidência vale mais que insistência**: uma pessoa pedindo muitas vezes é alcance 1; confiança acima de 50% exige mais de uma fonte.

### Riscos de produto (antes de construir)

Responda curto, só o que se aplica:

- **Demanda**: quem tem a dor hoje e qual o contorno? Há comportamento que mostra urgência (pagar, trabalho manual repetido, trocar de ferramenta, pedir de novo)?
- **Adoção**: a mudança altera o que as pessoas fazem, ou só acrescenta superfície? Dá para medir o uso com **um evento** claro?
- **Confiança**: exige dado, permissão, integração ou mudança de hábito que o usuário pode recusar?
- **Retorno**: dá motivo para voltar a usar, ou resolve uma vez?

O evento de adoção, se houver, vai para "Como saber se resolveu" no encaminhamento.

### Plano comercial (quando existe `.specs/produto/plano-comercial.md`)

Passe a sugestão pelos eixos e anote as seções do plano que ela toca. **Na dúvida, marque**: deixar de ver um impacto quebra a conta em silêncio; marcar à toa custa uma revisão curta.

| Eixo | Exemplo | Seções do plano |
|---|---|---|
| Monetização | cobrança nova, mudança de preço ou plano | 1, 6, 5 |
| Público | atender segmento novo | 2, 1, 5 |
| Canal | loja ou canal de aquisição novo | 3, 6 |
| Posicionamento | muda o diferencial frente a concorrente | 4, 5 |
| Custo estrutural | dependência paga, infraestrutura mais cara | 6, 5 |
| Premissa | evidência que confirma ou derruba uma premissa da seção 7 | 7, 5 |

Sem eixo tocado: "sem impacto comercial", com o porquê em uma frase. Com eixo tocado, a revisão das seções do plano é decisão do usuário (skill `plano-comercial`), anotada como condição na fase 6. Tamanho da implementação não mede impacto comercial.

### Veredito de valor

`alto` · `médio` · `baixo` · `sem evidência` (falta saber; candidata a observação com o que procurar).

```markdown
## Valor

- **Alcance**: <N por mês> (fonte | PREMISSA) · **Impacto**: <3–0,25> — <por quê> · **Confiança**: <100 | 80 | 50%> — <fontes>
- **Evidência**: <autor + N interessados; DEM-NNN; casos de suporte; dados de uso>
- **Alinhamento**: <sim | em parte | não> — <objetivo e como>
- **Riscos de produto**: <demanda, adoção (evento: ...), confiança, retorno — só os que se aplicam>
- **Plano comercial**: <não há | sem impacto — <porquê> | eixos <...> → seções <...>>
- **Veredito**: <alto | médio | baixo | sem evidência> — <uma frase>
```

## Fase 5: custo e risco

Com valor baixo ou sem evidência, pergunte se vale estimar (a fase pode ser `dispensada — valor <...>`).

- **Onde entraria**: `leitor-codigo` com o problema e o inventário (`.specs/projeto/inventario.md`, se existir): módulos tocados, o que já existe para reaproveitar. Sem código acessível, a estimativa é `PREMISSA`.
- **Esforço**: P (até 1 dia) · M (até 1 semana) · G (até 1 mês) · GG (mais: quebre em versões), em pessoa-semanas para o RICE, com **confiança** (informada pela leitura do código ou palpite).
- **Riscos**: técnico (área frágil, sem testes, legado), legal (dado pessoal novo, finalidade nova, terceiro recebendo dado: LGPD, `PREMISSA` até conferir), segurança (toca login, permissões, pagamento, dados pessoais), dependência externa (vira `integracao-terceiros`).
- **Manutenção**: o que passa a existir para sempre (tela, opção, configuração, suporte, documentação, teste).
- **Coerência do produto**: deixa o produto mais difícil de entender? desvia do propósito? cria exceção para um cliente?
- **Pré-mortem**: "daqui a seis meses, isto foi um erro. Por quê?" Liste 2 ou 3 causas plausíveis e, para cada uma, o que preveniria (critério de aceite, versão menor, medição, recusa). Vale também o inverso: o que garantiria que não resolve o problema?
- **Menor versão que resolve**: a fatia que ataca a dor com menos superfície, e o que fica para depois só se a primeira provar valor.

```markdown
## Custo e risco

- **Onde entraria**: <módulos, `arquivo:linha`; reaproveita <...>>
- **Esforço**: <P | M | G | GG> ≈ <N pessoa-semanas> · **Confiança**: <leitura do código | PREMISSA>
- **Riscos**: técnico <...> · legal <...> · segurança <...> · dependência <...>
- **Manutenção**: <...> · **Coerência**: <...>
- **Pré-mortem**: <causa → prevenção>; <...>
- **Menor versão**: <...> · **Depois, se provar valor**: <...>
- **Veredito**: <custo justificado | justificado só na menor versão | não justificado> — <uma frase>
```

## Fase 6: priorização

### A conta

`RICE = (Alcance × Impacto × Confiança) ÷ Esforço`, com os números das fases 4 e 5 à vista (ex.: `(40 × 1 × 0,8) ÷ 2 = 16`). Na menor versão, use o esforço dela.

### Comparar

- Com as demandas do registro `planejada`, `em observação` e `encaminhada` que tenham RICE, e com o trabalho em andamento em `.specs/` (features, bugs, redesign...). Tabela curta, maior RICE primeiro.
- Dependência real ordena antes do número (B precisa de A: A vem antes).
- **O que sai ou atrasa** se esta entrar agora, dito explicitamente: capacidade é finita.

### Antes de decidir

Mostre 2 ou 3 perguntas sobre a conta, ligadas ao que mais pesa nela (o número mais incerto, a premissa que, se errada, inverte a decisão, o que não se sabe sobre os usuários). Exemplo: "o alcance de 40 veio de 3 pedidos e de uma estimativa da base; se forem 5, a recomendação muda para observação". Quem conhece o negócio é o usuário.

### Decisão (do usuário)

Pergunte via `AskUserQuestion`, com a recomendada primeiro e o motivo na descrição:

| Decisão | Quando recomendar | Depois |
|---|---|---|
| **fazer agora** | RICE alto contra o backlog, alinhada, custo justificado | 7, depois 8 já |
| **planejar** | vale, mas outra coisa vem antes; diga a posição ou "próximo ciclo" sem data inventada | 7; 8 quando chegar a vez (situação `planejada`) |
| **observação** | valor incerto, pouca evidência ou cedo demais; diga **o que** faria mudar (gatilho) e **quando** revisitar | 7; volta às fases 4 a 6 no gatilho |
| **recusar** | fora do propósito, custo permanente maior que o valor, risco inaceitável, ou já resolvido de outra forma | 7 com o motivo; fecha |

```markdown
## Priorização

- **RICE**: (<A> × <I> × <C>) ÷ <E> = <N> <(menor versão)>
- **Comparação**: | Item | RICE | Situação | ... (até 5 linhas)
- **Sai ou atrasa**: <...>
- **Perguntas sobre a conta**: <2 ou 3, com a resposta do usuário>
- **Decisão**: <fazer agora | planejar — <posição> | observação — gatilho <...>, revisitar <data> | recusar — <motivo>> · aprovada em <data>
- **Condições**: <revisar seções do plano comercial | menor versão primeiro | ...>
```
