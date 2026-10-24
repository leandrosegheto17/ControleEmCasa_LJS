# Legal e propriedade (fase 3)

Responde: **o que é permitido fazer com isso?** Vem antes da execução porque código excelente que não se pode usar não vale nada.

> **Não é parecer jurídico.** Este roteiro levanta fatos com fonte e aponta riscos conhecidos. Achado `impeditivo` ou `condição` jurídica, e qualquer compra, cessão ou contrato, passam por advogado antes de assinar. Escreva este aviso no topo de `legal.md` e do relatório.

## 1. Licença do projeto

- Onde procurar: `LICENSE`, `COPYING`, `NOTICE`, cabeçalhos dos arquivos (`SPDX-License-Identifier`), campo `license` do manifesto (`package.json`, `pyproject.toml`, `Cargo.toml`, `*.gemspec`, `pom.xml`), README, página do repositório.
- Inconsistência entre esses lugares é achado (vale a mais restritiva até esclarecer).
- **Sem licença** = todos os direitos reservados: dá para ler, não para usar, copiar ou modificar. Impeditivo, salvo autorização escrita do titular.
- Produto comercial: a licença é o **contrato** (EULA, proposta). Leia o que ele permite: número de usuários, instalação, modificação, revenda, código-fonte entregue ou não, o que acontece se o fornecedor sumir (depósito do código-fonte, *escrow*).

## 2. Uso pretendido × família de licença

Regra geral, a confirmar no texto da licença e da versão exata:

| Família | Exemplos | Uso interno | SaaS (rede, sem entregar o programa) | Redistribuído (instalado, embarcado, revenda) |
|---|---|---|---|---|
| Permissiva | MIT, BSD, ISC, Apache-2.0, Zlib | ok | ok | ok, mantendo aviso de copyright e licença; Apache-2.0 também o `NOTICE` e a marcação de arquivos alterados |
| Copyleft fraco | LGPL, MPL-2.0, EPL-2.0 | ok | ok | ok, mas a parte do terceiro **modificada** sai com o código aberto (MPL: por arquivo; LGPL: a biblioteca, e o cliente precisa poder trocá-la) |
| Copyleft forte | GPL-2.0, GPL-3.0 | ok | em geral ok (não há distribuição) | o produto que a incorpora sai **sob GPL, com código-fonte** para quem recebe |
| Copyleft de rede | AGPL-3.0 | ok | versão **modificada** oferecida pela rede obriga a oferecer o código-fonte a quem a usa | como GPL |
| Código disponível, não aberto | SSPL, BUSL/BSL, Elastic-2.0, Commons Clause, PolyForm | ler os termos | costuma proibir serviço gerenciado, concorrência ou produção acima de um limite; BUSL vira licença aberta só na data de conversão | costuma proibir |
| Não comercial ou sem derivadas | CC BY-NC, CC BY-ND, "uso pessoal" | não comercial apenas | impeditivo para produto | impeditivo |

Pontos que costumam derrubar a avaliação:

- **AGPL ou SSPL** num serviço web fechado.
- **GPL** num produto instalado ou embarcado de código fechado.
- Combinações incompatíveis: Apache-2.0 com GPL-2.0-only; GPL-2.0-only com GPL-3.0 ("ou posterior" resolve).
- **Licença dupla** (GPL ou comercial): o uso fechado exige comprar a comercial; entra no custo.
- Mudança de licença recente no projeto de origem (de aberta para código disponível): a versão que você usa e as próximas podem ter licenças diferentes. Ponto para o `pesquisador` e para a fase 8.

Onde está a fronteira de "obra derivada", "distribuição" ou "modificação" é questão jurídica: registre o caso, a leitura comum e marque para o advogado.

## 3. Licenças das dependências

1. Liste as dependências **diretas** pelos manifestos e as transitivas pelo lockfile (`leitor-codigo`, sem instalar nada).
2. Ferramenta **já instalada** que lê sem instalar o projeto: `licensee` (licença do projeto), `scancode` (cabeçalhos e trechos copiados), `syft` (lista de componentes com licença), `trivy fs --scanners license`, `reuse lint`. Faltou: `NÃO EXECUTADO` e pergunta via `AskUserQuestion` (instalar é decisão do usuário; instalar no ambiente isolado da fase 4 é o recomendado).
3. Ferramentas que precisam das dependências instaladas (`pip-licenses`, `license-checker`, `pnpm licenses list`, `go-licenses`, `cargo license`, `license_finder`) rodam **na fase 4**, no ambiente isolado, e completam a seção **Complemento da execução** de `legal.md`. Até lá, as transitivas ficam `não verificadas`.
4. Sem ferramenta: `pesquisador` confere a licença de cada dependência direta na página oficial do pacote, com a versão e a data da consulta.
5. Cada dependência fora das permissivas é cruzada com o uso pretendido (tabela acima). Saídas brutas em `evidencias/licencas*`.

## 4. Código copiado e componentes pagos

- Busque na cópia: `Copyright`, `SPDX-License-Identifier`, `Licensed under`, `GNU General Public`, `stackoverflow.com` (trechos sob CC BY-SA), pastas `vendor/`, `third_party/`, `lib/` com código de outros projetos sem o aviso de licença.
- Componentes com licença paga por desenvolvedor, domínio ou servidor (fontes, ícones, temas, SDKs, bibliotecas de gráficos, relatórios): a licença é transferível para quem compra ou herda? Está em nome de quem?

## 5. Titularidade e cessão (comprar, herdar, contratar quem fez)

- **Quem escreveu**: `git shortlog -sne --all` na cópia (saída em `evidencias/`; e-mails são dados pessoais). Compare com a lista de pessoas e contratos que o vendedor entregou. Autor sem contrato que o cubra é lacuna.
- **Contratos**: a Lei 9.609/1998 (Lei do Software, art. 4º) atribui ao empregador ou contratante o programa feito dentro de vínculo destinado a isso, salvo estipulação em contrário; fora disso (trabalho anterior ao contrato, projeto pessoal, colaborador sem contrato, freelancer com contrato que não trata de direitos) a titularidade é duvidosa. Peça os contratos e, na compra, a **cessão escrita** dos direitos patrimoniais, cobrindo código, documentação, marca e domínio. Confirmar com advogado.
- **Contratar quem fez**: o trabalho mostrado é de quem diz? (autoria no histórico, não só o último commit). Ele podia mostrá-lo (código de ex-empregador ou cliente exposto é sinal ruim)?
- **Contribuir**: o projeto exige acordo de contribuição (CLA) ou assinatura DCO? O que o CLA cede?

## 6. Marcas e nomes

- Nome e logotipo do produto: registrados por quem? (consulta pública no INPI, pelo `pesquisador`). Entram na compra? E o domínio e os perfis?
- Dependência aberta: a licença de código **não dá direito à marca** (a Apache-2.0 diz isso explicitamente). Não use o nome do projeto como nome do produto sem permissão.

## 7. Dados pessoais (LGPD)

- O sistema trata dados pessoais? Quais, de quem, sensíveis (saúde, biometria, religião, menores)?
- **Na avaliação**: não receba nem abra base real com dados pessoais; peça dados anonimizados ou de teste. Se vier junto, registre e avise (saída da `SKILL.md`).
- **Na compra com base de clientes**: quem será o controlador, com que base legal os dados passam, como os titulares serão informados. Para o advogado ou o encarregado de dados.
- No sistema: coleta além do necessário para a finalidade (minimização), onde ficam os dados (transferência internacional), quem são os operadores (serviços de terceiros que recebem dados), retenção e descarte, atendimento aos direitos do titular (existe como consultar e excluir os dados de uma pessoa?), política de privacidade, incidentes anteriores. O que depende de código é conferido nas fases 4 a 6. Cada item recebe resposta com evidência ou "não se aplica" com o porquê, nunca pulado em silêncio.

## 8. Obrigações de uso

Liste o que adotar obriga a fazer, com o custo na fase 9: avisos de licença na distribuição (tela "sobre", arquivo de terceiros), `NOTICE`, oferta de código-fonte, marcação de arquivos alterados, termos de uso de APIs e serviços usados (limites para uso comercial), auditoria de licenças a cada atualização.

## Modelo de `legal.md`

```markdown
# Legal e propriedade: <slug>

> Não é parecer jurídico. Itens marcados "advogado" precisam de revisão profissional antes de assinar ou adotar.

- **Data**: <AAAA-MM-DD> · **Commit da cópia**: <hash> · **Uso pretendido**: <de `avaliacao.md`>
- **Ferramentas**: <nome — OK | NÃO EXECUTADO (motivo) | na fase 4>

## Licença do projeto
- **Declarada**: <SPDX> em <`arquivo`, manifesto, cabeçalhos> · **Inconsistências**: <nenhuma | ...>
- **Contra o uso pretendido**: <compatível | condição: <...> | impeditivo: <...>> — advogado: <sim | não>

## Dependências
| Dependência | Versão | Direta? | Licença | Fonte (data) | Contra o uso pretendido |
|---|---|---|---|---|---|
- **Transitivas**: <N verificadas por <ferramenta> | não verificadas até a fase 4>

## Código copiado e componentes pagos
- <achado com `arquivo:linha`> | nenhum encontrado (buscas feitas: <...>)

## Titularidade
- **Autores no histórico**: <N pessoas; detalhe em `evidencias/`> · **Cobertos por contrato**: <N | [A ESCLARECER]>
- **Cessão**: <prevista na proposta | ausente | não se aplica (dependência)> — advogado: <sim | não>

## Marcas e nomes
## Dados pessoais (LGPD)
## Obrigações de uso
## Complemento da execução (fase 4)
## Para o advogado
- <pergunta objetiva, com o fato e a fonte>
```

Cada problema vira linha em `achados.md`, com o efeito na decisão: eliminatório de licença ferido é `impeditivo`; resolve-se com contrato, cessão, troca de dependência ou licença comercial é `condição`; obrigação que só dá trabalho é `custo`.
