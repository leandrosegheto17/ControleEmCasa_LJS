# Segurança e legal (fase 4)

Responde: **que dados saem e quem responde por eles?** Vem antes do desenho porque o que não pode sair muda o desenho (minimização, pseudônimo, checkout hospedado).

> **Não é parecer jurídico.** Este roteiro organiza fatos com fonte e aponta riscos conhecidos. Base legal, papéis e contrato com o fornecedor são decisão do controlador, com o encarregado de dados ou advogado quando houver dúvida. Escreva este aviso no topo de `seguranca-legal.md`.

## Fatos legais: sempre conferidos

Os fatos abaixo vêm de memória e são **`PREMISSA` até o `pesquisador` conferir** na fonte oficial (texto da Lei 13.709/2018 no Planalto, resoluções no site da ANPD), com a data da consulta. Despache um `pesquisador` com a lista dos que esta integração usa. Conferido, troque `PREMISSA` pela URL e data.

| Tema | Referência (PREMISSA) |
|---|---|
| Bases legais para dado pessoal | LGPD art. 7 (dez hipóteses, entre elas consentimento, execução de contrato a pedido do titular, obrigação legal, legítimo interesse, proteção do crédito) |
| Dado sensível (saúde, biometria, origem racial, religião, vida sexual, opinião política, filiação sindical, genético) | LGPD art. 11, com hipóteses mais restritas; menores, art. 14 |
| Controlador e operador | LGPD art. 5 (definições), art. 39 (operador trata segundo as instruções do controlador), art. 42 (responsabilidade) |
| Transferência internacional | LGPD art. 33; regulamento da ANPD com cláusulas-padrão contratuais (Resolução CD/ANPD nº 19/2024) |
| Direitos do titular e prazos | LGPD arts. 18 e 19 (resposta completa em até 15 dias) |
| Registro das operações e relatório de impacto | LGPD arts. 37 e 38 |
| Comunicação de incidente | LGPD art. 48; Resolução CD/ANPD nº 15/2024 (prazo de 3 dias úteis), já usada pela skill `incidente` |
| Cartão de pagamento | PCI DSS (versão vigente a conferir): não guardar código de segurança, trilha nem PIN; checkout hospedado ou tokenização do fornecedor tiram o número do cartão dos nossos sistemas e reduzem o escopo |

## 1. Dados que saem e que voltam

Campo a campo, para cada operação de `contrato.md`:

- **O que sai**, para quê, e se é **necessário** para a finalidade (minimização: o que não é necessário não sai; identificador interno em vez de CPF quando o fornecedor aceita).
- **O que volta** e o que guardamos disso (e por quanto tempo).
- **Onde o fornecedor guarda** (país, região), por quanto tempo, e se usa os dados para fins próprios (treinar modelo, marketing, antifraude compartilhado). Fonte: termos, política de privacidade, contrato de tratamento.
- **Dado sensível ou de menor**: marque; muda a base legal e a severidade.
- **Cartão**: o número do cartão passa pelos nossos sistemas? Preferir checkout hospedado ou campo do fornecedor no navegador (o servidor só vê um token).

## 2. LGPD

Cada item com resposta e fonte, ou `não se aplica — <porquê>`, ou `[A ESCLARECER]` para o controlador; nunca pulado em silêncio.

- **Papéis**: nós somos controlador (decidimos o tratamento)? O fornecedor é **operador** (trata em nosso nome, segundo instruções) ou **controlador independente** (usa os dados para fins próprios; comum em antifraude, meios de pagamento, redes sociais)? A resposta muda o contrato e o aviso de privacidade.
- **Base legal** por finalidade (uma por finalidade, não uma para tudo). Consentimento só quando nenhuma outra cabe; se for ele, o registro do consentimento é requisito da spec.
- **Transferência internacional**: os dados saem do Brasil? Por qual mecanismo (cláusulas-padrão no contrato do fornecedor, outro previsto no regulamento)?
- **Contrato com o fornecedor**: há acordo de tratamento de dados (DPA)? Cobre instruções, confidencialidade, segurança, suboperadores, aviso de incidente com prazo, apagamento ou devolução no fim, auditoria? Onde está (link, não cópia).
- **Direitos do titular**: se alguém pedir para apagar ou ver seus dados, o que precisa acontecer no fornecedor (API de exclusão, pedido manual)? Vira requisito ou procedimento.
- **Transparência**: o aviso de privacidade do produto lista este compartilhamento? Se não, atualizar é tarefa (texto aprovado pelo controlador).
- **Registro das operações**: acrescentar esta operação ao registro do controlador, se houver.
- **Incidente no fornecedor**: como ele avisa, em quanto tempo; é entrada do runbook (fase 9).

**Lacuna de obrigação legal não vira débito**: bloqueia a fase até resolver ou até o controlador decidir por escrito. Decisão de negócio (finalidade, base legal) é do usuário ou do encarregado, nunca da sessão.

## 3. Segredos e permissões

- **Onde ficam**: cofre de segredos do ambiente ou variáveis de ambiente injetadas no deploy; **nunca** no código, em arquivo versionado, em artefato, em log, em mensagem de erro ou na conversa. `.env` local fora do git (confira o `.gitignore`).
- **Separação**: chave de sandbox e de produção diferentes, em lugares diferentes; testes e CI só com a de sandbox (ou nenhuma: a suíte padrão usa o simulado). **Nunca chave de produção em teste.**
- **Escopo mínimo**: a chave tem só as permissões que as operações de `contrato.md` precisam (chave restrita, escopos OAuth mínimos, somente leitura quando bastar). Restrição por IP ou domínio, se o fornecedor oferecer.
- **Quem acessa** a chave de produção e o painel do fornecedor; autenticação em dois fatores na conta do fornecedor.
- **Rotação**: como trocar sem parar o serviço (duas chaves ativas na troca), com que frequência, e o que fazer se vazar (trocar é o que resolve; skill `incidente` se houve uso indevido).
- **Segredo de webhook**: guardado como as chaves; a assinatura é conferida em toda chamada recebida.

## 4. Entrada externa

- O que o fornecedor devolve é validado (tipo, faixa, campos obrigatórios) antes de entrar no domínio; campo novo desconhecido é ignorado, não quebra.
- Webhook: assinatura conferida com comparação em tempo constante, tolerância de horário contra repetição, evento deduplicado pelo identificador, e confirmação do estado consultando a API quando o evento muda dinheiro ou acesso.
- URL ou conteúdo vindo do terceiro nunca é seguido ou executado sem validação (redirecionamento, HTML, arquivo).

## Modelo de `seguranca-legal.md`

```markdown
# Segurança e legal: <fornecedor> — <caso de uso>

> Não é parecer jurídico. Itens "controlador" ou "advogado" precisam de decisão de quem responde pelos dados.

- **Data**: <AAAA-MM-DD> · **Fatos legais conferidos em**: <AAAA-MM-DD, pesquisador | pendente>

## Dados

| Operação | Campo | Sai/volta | Necessário? | Sensível? | Guardado onde e por quanto tempo |
|---|---|---|---|---|---|

- **Fornecedor guarda em**: <país/região, prazo> · **Usa para fins próprios**: <não | sim: ...> — <fonte>
- **Cartão nos nossos sistemas**: <não — checkout hospedado/token | sim — escopo PCI: ...>

## LGPD

- **Papéis**: nós <controlador | operador de <cliente>> · fornecedor <operador | controlador independente> — <fonte>
- **Base legal**: <finalidade → base (art.)> — <conferido: URL (data) | PREMISSA>
- **Transferência internacional**: <não | sim — mecanismo: ...>
- **Contrato de tratamento**: <link | inexistente — decisão: ...>
- **Direitos do titular no fornecedor**: <API | manual | não se aplica>
- **Aviso de privacidade**: <cobre | atualizar — tarefa>
- **Incidente no fornecedor**: <como e em quanto tempo avisa>

## Segredos e permissões

- **Onde**: <cofre/variáveis — nomes das variáveis, nunca valores>
- **Escopo da chave**: <permissões> · **Restrição por IP**: <sim | não disponível>
- **Rotação**: <frequência, procedimento> · **Acesso ao painel**: <quem, 2FA>

## Requisitos para a spec

- <cada item que vira critério de aceite na fase 5: minimização, validação, assinatura, consentimento, exclusão>

## Risco

- **Aceitável?** <sim (AAAA-MM-DD, usuário) | não — volta à escolha | condição: ...>
- **Para o controlador / advogado**: <pergunta objetiva, com o fato e a fonte>
```
