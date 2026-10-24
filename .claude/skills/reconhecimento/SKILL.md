---
name: reconhecimento
description: Mapeia onde uma mudança entra num projeto existente antes de planejar — módulos e arquivos afetados, padrões e convenções em uso, testes existentes e como rodá-los, dívidas e pontos frágeis no trecho, e se a mudança exige alteração grande de arquitetura — gravando .specs/features/<feature>/reconhecimento.md. Use depois da spec de uma feature, antes do plano, ou quando a skill feature mandar. Também serve para bug, refatoração e legado. Não planeja nem implementa.
---

# Reconhecimento

Responde: **onde esta mudança entra, como o projeto já faz coisas parecidas, e o que pode quebrar?** Sem isso, a IA inventa padrões próprios e duplica o que já existe.

## Pré-requisitos

- A spec da feature (`.specs/features/<feature>/spec.md`) ou, para outros fluxos, a descrição da mudança. Em correção de bug, a entrada é `.specs/bugs/<slug>/relato.md` e o arquivo vai para essa mesma pasta; a tabela de reaproveitamento pode ficar curta. Em refatoração, a entrada é `.specs/refatoracoes/<slug>/refatoracao.md` (alvo e meta) e o arquivo vai para essa pasta; a skill `refatoracao` acrescenta depois a seção de contratos e acoplamento. Em performance, a entrada é `.specs/performance/<slug>/performance.md` (meta) com `opcoes.md` (mudanças escolhidas), e o arquivo vai para essa pasta. Em redesign, a entrada é `.specs/redesign/<slug>/redesign.md` (escopo de telas e o que não muda), o arquivo vai para essa pasta e as perguntas extras estão em `redesign/references/inventario-telas.md`.
- Se `reconhecimento.md` já existir, confirme antes de refazer; se o código mudou desde a data dele, ofereça atualizar.

## 1. Contexto do projeto

Procure o arquivo de instruções do projeto (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`), o README e as convenções documentadas. Se não houver nenhum contexto escrito, registre isso: ao fim da feature, a fase de integração vai criar um contexto mínimo. Se o projeto é difícil de entender e nada está escrito, ofereça antes a skill `documentar` (fluxo 14). Se `.specs/documentacao/*/` existir, use `arquitetura.md`, `comportamento.md` e `convencoes.md` como ponto de partida.

## 2. Mapear com o `leitor-codigo`

Despache o agente `leitor-codigo` (pode ser mais de um em paralelo, cada um com uma pergunta) com:

1. **Onde entra:** que arquivos e módulos a mudança vai tocar ou criar, dados os critérios de aceite da spec.
2. **Como o projeto já faz:** a funcionalidade mais parecida que já existe (ex.: outra tela de cadastro, outro endpoint, outra regra), com `arquivo:linha`, para servir de modelo.
3. **Padrões:** organização de pastas e camadas, nomes, tratamento de erro, acesso a dados, validação, estilo dos testes.
4. **Testes:** que testes cobrem o trecho, como rodar a suíte (comando), e o que **não** tem teste.
5. **Fragilidades:** duplicação, código morto, arquivos grandes, dependências antigas, gambiarras no trecho.

## 3. O que reaproveitar

Leia `.specs/projeto/inventario.md` (se não existir ou estiver desatualizado, acione antes a skill `inventario`). Para **cada necessidade** da feature (cada tela, regra, endpoint, dado, utilitário, biblioteca), procure no inventário e decida:

- **reaproveitar**: uma peça existente já faz isso;
- **estender**: uma peça existente faz quase isso e pode ganhar um parâmetro ou variação, sem quebrar quem já a usa;
- **criar novo**: nada serve. **Diga por que** cada candidata não serve.

Biblioteca nova só entra se nenhuma instalada resolver. Se o inventário apontar duplicação na área, use a peça indicada em "Usar".

## 4. Avaliar o tamanho e o risco

Com o mapa, classifique:

- **Encaixe:** a feature segue um padrão que já existe (bom), estende um padrão (atenção), ou exige um padrão novo (alto).
- **Arquitetura:** a feature cabe na estrutura atual, ou exige mudar camadas, modelo de dados central ou contratos usados por outras partes?
- **Raio de impacto:** quantas partes do sistema dependem do que será alterado.
- **Telas:** a mudança cria ou muda telas? Liste quais. Se sim, **Mockup** fica `pendente` (o orquestrador oferece o mockup antes do plano); se não, `não se aplica`.

**Escalonamento:** se a feature exige mudança grande de arquitetura, **pare** e pergunte via `AskUserQuestion`: refatorar antes (skill `refatoracao`), reduzir o escopo da feature, ou seguir mesmo assim com o risco registrado.

## 5. Gravar `reconhecimento.md`

```markdown
# Reconhecimento: <feature>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto>
- **Contexto do projeto**: <arquivo encontrado | nenhum (criar na integração)>
- **Encaixe**: segue padrão | estende padrão | padrão novo
- **Arquitetura**: cabe | exige mudança (<qual>)
- **Telas**: nenhuma | cria <quais> | muda <quais>
- **Mockup**: não se aplica | pendente (o orquestrador troca para `aprovado` ou `dispensado — <motivo>`)
- **Plano aprovado em**: pendente (feature e legado: o orquestrador grava a data ao aprovar o plano)

## Onde entra

| Arquivo ou módulo | O que muda | Novo? |
|---|---|---|
| `caminho` | <...> | sim/não |

## Reaproveitamento

| Necessidade da feature | Peça existente | Decisão | Por que (obrigatório em "criar novo") |
|---|---|---|---|
| <ex.: formatar valor em reais> | `src/utils/moeda.ts:12` | reaproveitar | — |
| <ex.: tela de listagem> | `ListaPaginada` (`src/ui/lista.tsx`) | estender | precisa de filtro por data |
| <ex.: cálculo de comissão> | nenhuma | criar novo | nenhuma regra parecida no inventário |

## Modelo a seguir

- <funcionalidade parecida> — `arquivo:linha` — <o que copiar dela>

## Convenções do projeto

- <padrão> — exemplo em `arquivo:linha`

## Testes

- **Rodar a suíte**: `<comando>`
- **Cobrem o trecho**: <testes e caminhos>
- **Sem teste**: <comportamentos que serão tocados e não têm teste>

## Fragilidades e riscos

- <fragilidade ou risco> — `arquivo:linha`
```

## Ao terminar

Responda com o caminho do arquivo, quantas necessidades serão reaproveitadas / estendidas / criadas, o encaixe, a avaliação de arquitetura, os 3 principais riscos e o que fica sem teste, e pergunte via `AskUserQuestion`: **seguir para o plano / ajustar / parar**.

## Regras

- Somente leitura no código; escreva só o `reconhecimento.md`.
- Toda afirmação sobre o código cita `arquivo:linha`.
- Tudo em português.
