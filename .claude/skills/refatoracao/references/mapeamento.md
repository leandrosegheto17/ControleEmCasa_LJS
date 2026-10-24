# Mapeamento: contratos e acoplamento (fase 3)

Depois da skill `reconhecimento` (e da `arqueologia`, no legado) gravar na pasta da refatoração, acrescente ao `reconhecimento.md` a seção **Contratos e acoplamento**. Ela responde: **o que depende do alvo, e o que não pode mudar por fora?**

## 1. Pedidos ao `leitor-codigo` (em paralelo)

1. **Quem chama o alvo:** chamadas diretas, pontos registrados (rotas, comandos, injeção de dependência, eventos assinados), leitores do mesmo dado (tabelas, arquivos, filas), testes. Com `arquivo:linha`. Cuidado com chamada dinâmica (reflexão, nome em texto, configuração): liste como "possível, não confirmado".
2. **Quem o alvo chama:** módulos internos, bibliotecas, serviços externos, banco.
3. **Mudança conjunta (git):** arquivos que mudam junto com o alvo nos últimos 6 meses. Mudar sempre junto sem import entre eles indica regra duplicada.
4. **Volatilidade:** commits por arquivo do alvo e dos vizinhos em 6 meses (`git log --since="6 months ago" --format= --name-only | sort | uniq -c | sort -rn | head -20`), TODO e FIXME, testes que quebram muito.

## 2. Contratos (o que fica igual)

Liste **tudo o que é observável de fora do alvo**. É a lista que a rede de proteção caracteriza e que o verificador confere no fim:

- assinaturas públicas: funções, classes e tipos exportados, com parâmetros, padrões e retorno;
- rotas, comandos e mensagens: caminho, formato de entrada e saída, códigos de status;
- erros: tipo, mensagem e código que alguém trata ou exibe;
- efeitos colaterais: escrita em banco, arquivo, fila, e-mail, chamada externa, e a ordem em que acontecem;
- formato e ordem de dados: campos, ordem de listas e de iteração, arredondamento, datas e fuso;
- esquema de dados e eventos lidos por outras partes;
- logs ou métricas que alguém lê (alerta, painel, relatório).

Contrato "acidental" (alguém depende de um detalhe interno) também é contrato: fica igual nesta refatoração, ou é tratado com a pessoa dona antes, com decisão do usuário.

## 3. Acoplamento

Para cada dependência relevante entre o alvo e um vizinho, classifique três dimensões:

| Dimensão | Baixa | Alta |
|---|---|---|
| **Força** (o que é compartilhado) | **contrato**: interface ou formato feito para integrar | **intrusivo**: lê o interno do outro (banco de outro módulo, campo privado, estrutura de arquivo); **funcional**: regra repetida ou ordem obrigatória de chamadas; **modelo**: expõe o modelo interno inteiro |
| **Distância** (onde mora) | mesma função, classe ou pacote | módulos, serviços ou equipes diferentes |
| **Volatilidade** (quanto muda) | genérico ou de apoio (login, e-mail, CRUD simples), pouco commit | núcleo do negócio, muitos commits |

Diagnóstico:

| Força | Distância | Volatilidade | Leitura |
|---|---|---|---|
| alta | alta | alta | **crítico**: mudança cara que se propaga longe; é o que a refatoração deve quebrar primeiro |
| alta | alta | baixa | aceitável: forte mas estável (integração antiga que não muda) |
| alta | baixa | qualquer | bom: coeso, muda junto e mora junto |
| baixa | alta | qualquer | bom: separado e independente |
| baixa | baixa | alta | **atenção**: coisas sem relação misturadas no mesmo lugar |

Sinais rápidos: regra de negócio duplicada (funcional simétrico) → extrair para um lugar só; leitura do banco de outro módulo (intrusivo) → expor um contrato; objeto de domínio inteiro passado adiante (modelo) → objeto de integração com só o que o outro usa; "lembre de mudar X quando mudar Y" num comentário → acoplamento funcional não declarado.

## 4. Gravar no `reconhecimento.md`

```markdown
## Contratos e acoplamento

### Quem depende do alvo
| Dependente | Como usa | Onde | Confirmado? |
|---|---|---|---|
| <módulo, rota, tarefa, relatório> | <chama, lê a tabela, assina o evento> | `arquivo:linha` | sim / possível |

### Contratos (não podem mudar)
- <contrato> — `arquivo:linha` — <caracterizado em `protecao.md`: pendente | teste>

### Acoplamento
| Par | Força | Distância | Volatilidade | Leitura | Ação nesta refatoração |
|---|---|---|---|---|---|
| alvo → <vizinho> | <intrusivo / funcional / modelo / contrato> | <...> | <commits em 6 meses> | <crítico / atenção / ok> | <quebrar / manter / fora do escopo> |

### Dados e integrações afetados
- <tabela, fila, serviço externo> — <como a refatoração pode afetar>

### Caminho quente?
<não | sim: <onde>, medir desempenho na fase 4>
```

Raio de impacto grande demais para o modo escolhido (muitos dependentes, contrato entre equipes, dado compartilhado): proponha subir para o modo **grande** antes de aprovar a fase.
