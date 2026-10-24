# Base de conhecimento e aprendizado (fases 3 e 9)

Resolver uma vez e escrever evita resolver dez. A base fica em `.specs/demandas/base-conhecimento.md`, ao lado do registro, porque a contagem de casos repetidos vem das demandas e a busca de duplicados olha um lugar só. Vai no git: **nenhum dado pessoal**, só sintomas, respostas e IDs.

## Tags de causa raiz

Uma por caso, pela **causa**, não pelo sintoma ("não consigo entrar" pode ser `clareza`, `conta` ou `defeito`). Vocabulário fixo, para a contagem funcionar; tag nova só com motivo, acrescentada à lista do arquivo.

| Tag | Quando | Sinal para o produto, se repetir |
|---|---|---|
| `clareza` | o produto faz, mas a pessoa não achou ou não entendeu | tela, texto ou fluxo confuso: sugestão (fluxo 10) ou `redesign` |
| `documentacao` | a ajuda ou a documentação falta, está errada ou desatualizada | corrigir a documentação (skill `documentar` ou `feature`) |
| `defeito` | bug confirmado | recorrência na skill `bug` (mesma causa em 3 ou mais) |
| `conta` | configuração, permissão, cadastro ou dado da conta da pessoa | validação ou padrão melhor: sugestão |
| `cobranca` | valor, fatura, plano, pagamento | regra ou comunicação de cobrança: sugestão ou quem decide |
| `terceiro` | serviço externo (pagamento, e-mail, integração) | resiliência ou troca de fornecedor: `integracao-terceiros` |
| `desempenho` | lento, sem erro | skill `performance` |
| `falta-funcao` | o produto não faz o que a pessoa precisa | sugestão (fluxo 10), com a pessoa como evidência |
| `expectativa` | o produto faz como decidido, e a pessoa esperava outra coisa | comunicação de venda ou decisão do produto a rever: sugestão |
| `seguranca` | falha de segurança relatada | prevenção do `incidente` ou da `auditoria-seguranca` |

## Fase 9: aprendizado

1. **Tag** em `suporte.md` (**Causa raiz**: tag e uma frase).
2. **Base**: o caso ensinou uma resposta que vale para outras pessoas? Crie a entrada (`BC-NNN`, o maior mais um) ou atualize a existente: acrescente o `DEM-NNN` em **Casos**, some 1 em **Contagem**, corrija a resposta se ela mudou. Resposta só para essa pessoa (dado da conta dela) não entra. A resposta é escrita a partir do que funcionou e foi confirmado (fase 7), com a fonte oficial (documentação, tela, spec); o incerto fica marcado.
3. **Repetição**: conte os casos com a mesma tag e o mesmo tema (entrada da base, ou sintoma) nos últimos 90 dias (padrão sugerido, `PREMISSA`). Com **3 ou mais** (como a recorrência da skill `bug`), é problema no produto, não no usuário. Pergunte via `AskUserQuestion`:
   - **registrar uma sugestão interna** (Recomendado para `clareza`, `documentacao`, `conta`, `expectativa`, `falta-funcao`): skill `demandas`, **Registrar**, tipo `sugestão`, autor `equipe`, **Originada de** este caso, com os `DEM-NNN` como evidência; segue na skill `sugestao` (fluxo 10). Já existe uma sugestão com o mesmo problema: os autores dos casos viram **Interessados** dela (juntar pela `demandas`), e a dela pode sair de `em observação` (o gatilho é a evidência nova). Assim pedidos recorrentes viram prioridade;
   - **recorrência de bug**: a skill `bug` já checa na fase 9 dela; aponte os casos;
   - **só contar** por enquanto, com o motivo.
4. **Ideia junto com o problema** (a pessoa sugeriu algo além do caso): demanda nova `sugestão` com **Originada de**, mesmo sem repetição.
5. **Contato**: sem outra demanda aberta da pessoa e sem consentimento para novo contato, ofereça apagar a linha em `contatos.md` (skill `demandas`).

## Modelo de `.specs/demandas/base-conhecimento.md`

Criado no primeiro caso que gera uma entrada ou nos primeiros combinados. Em cada entrada, só o que vale para qualquer pessoa.

```markdown
# Base de conhecimento do suporte

- **Atualizado em**: <AAAA-MM-DD>

## Combinados

| Prioridade | Próxima notícia em | Fonte |
|---|---|---|
| P0 | <1 hora> | <usuário em <data> | PREMISSA> |
| P1 | <4 horas úteis> | |
| P2 | <1 dia útil> | |
| P3 | <2 dias úteis> | |

- **Espera por resposta da pessoa**: <3 dias úteis, um lembrete> · **Janela de repetição**: <90 dias>
- **Canais de atendimento**: <e-mail, chat, ferramenta de suporte>
- **Alçadas**: <tipo → papel que decide, canal, prazo de retorno> (sem nome nem contato pessoal)

## Entradas

### BC-001: <sintoma, nas palavras de quem usa>

- **Tag**: <tag> · **Contagem**: <N> · **Casos**: DEM-NNN, DEM-NNN
- **Vale para**: <versão, plano, plataforma> · **Revisada em**: <data> · **Fonte**: <documentação | tela | spec | caso confirmado DEM-NNN>
- **Pergunta**: <uma frase, como a pessoa pergunta>
- **Resposta**: <uma ou duas frases e o passo a passo; o incerto marcado>
- **Se não resolver**: <o que olhar no diagnóstico | escalar a <papel>>
- **Melhoria ligada**: <— | DEM-NNN (sugestão) | bug <slug>>

## Problemas conhecidos

| Desde | Sintoma | Contorno | Ligação | Casos |
|---|---|---|---|---|
| <data> | <...> | <...> | bug <slug> | DEM-NNN, DEM-NNN |
```

Problema conhecido sai da tabela quando o bug fecha (a entrada pode virar `BC-NNN` se a dúvida continuar). Entrada que deixou de valer (o produto mudou) não se apaga: ganha **Revisada em** e "não vale a partir de <versão>".
