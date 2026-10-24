# Modelo de `.specs/produto/necessidade.md`

```markdown
# Necessidade: <título curto>

- **Data**: <AAAA-MM-DD>
- **Veredito**: construir | adaptar algo pronto | desistir
- **Motivo de construir** (se construir): nada pronto serve | quero aprender <tecnologia> | outro: <...>

## 1. Necessidade

- **O que resolve**: <dor ou desejo, em uma ou duas frases>
- **Como faço hoje**: <...>
- **Frequência de uso**: <diária | semanal | eventual>

## 2. O que já existe

| Solução | Cobre | Não cobre | Licença e custo | Roda local (Docker)? | Ativa? | Fonte |
|---|---|---|---|---|---|---|
| <...> | <...> | <...> | <...> | sim/não | <último lançamento> | <url> |

- **Conclusão**: <por que construir, ou qual adaptar>

## 3. Escopo pessoal

- **Essencial**:
  - <funcionalidade>
- **Fica de fora**:
  - <...>
- **Bom o bastante quando**: <critério simples de "pronto para eu usar">

## 4. Restrições

- **Onde roda**: local com Docker | nuvem gratuita (<serviço>) | os dois
- **Limites do plano gratuito** (se nuvem): <armazenamento, pausa por inatividade, expiração> — [fonte, data da consulta]
- **Stack**: <tecnologias> — <já domino | quero aprender>
- **Exposição**: só rede local | internet (com autenticação e HTTPS)

## 5. Dados e backup

- **Dados guardados**: <...>
- **Custo de perder**: <baixo | médio | alto> — <por quê>
- **Backup**: <o que, para onde, com que frequência>
- **Teste de restauração**: obrigatório na validação

## 6. Riscos e dúvidas

- <risco ou [A ESCLARECER: ...]>
```

Requisitos que viram critérios de aceite na especificação (fase 4):

- backup automático conforme a seção 5;
- restauração do backup testada a partir de uma cópia limpa;
- se exposta à internet: autenticação e HTTPS.
