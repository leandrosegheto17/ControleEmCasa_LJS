import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analisarMigracao,
  conferirMigracoes,
  linhaDoLogAprovada,
  main,
  type ArquivoMigracao,
  type Contexto,
} from './migracao-aditiva';

/**
 * G-43 (etapa 16; ADR-015): as migrations são aditivas. `drop`, `rename` e `alter type` (e o que quebra o código que
 * já está no ar: NOT NULL sem default em tabela existente, SET NOT NULL, TRUNCATE) exigem justificativa ligada a uma
 * fase expand publicada ou a uma linha do Log de Alterações do GUARDRAILS. O passo roda no CI (`ci.yml`, job `base`).
 */

const RAIZ = join(import.meta.dirname, '../../../..');
const PASTA = join(RAIZ, 'backend/scripts/migracoes');

const LOG_VAZIO = `## Log de Alterações

| Data | Proposto por | Aprovado por | Mudança | Motivo | Validade |
|---|---|---|---|---|---|
| 2026-10-24 | segurança (agente) | — (pendente) | Versão inicial G-01…G-55 | Etapa 0 do PLANO | — |
`;

const ctx = (parcial: Partial<Contexto> = {}): Contexto => ({
  arquivos: ['20261101000000_a.sql', '20261102000000_b.sql', '20261103000000_c.sql'],
  logGuardrails: LOG_VAZIO,
  ...parcial,
});

const motivos = (sql: string, arquivo = '20261103000000_c.sql', c = ctx()) =>
  analisarMigracao({ arquivo, sql }, c).violacoes.map((v) => v.motivo);

describe('as migrations do repositório', () => {
  it('são todas aditivas hoje (nenhuma violação e nenhuma exceção)', () => {
    const arquivos = readdirSync(PASTA).filter((a) => a.endsWith('.sql'));
    expect(arquivos.length).toBeGreaterThan(10);
    const lidas: ArquivoMigracao[] = arquivos.map((arquivo) => ({
      arquivo,
      sql: readFileSync(join(PASTA, arquivo), 'utf8'),
    }));
    const r = conferirMigracoes(lidas, {
      arquivos,
      logGuardrails: readFileSync(join(RAIZ, '.md/GUARDRAILS.md'), 'utf8'),
    });
    expect(r.erros).toEqual([]);
    expect(r.excecoes).toEqual([]);
  });
});

describe('o que é aditivo passa', () => {
  it.each([
    'create table app.nova (id uuid primary key, nome text not null);',
    'alter table app.conta add column apelido text;',
    'alter table app.conta add column ordem int not null default 0;',
    'alter table app.conta add column criado_em timestamptz not null default now();',
    'alter table app.conta add column total int generated always as (1) stored not null;',
    'create index conta_nome on app.conta (nome);',
    'alter table app.conta alter column nome drop not null;',
    "alter type app.situacao add value 'nova';",
    'grant select on app.conta to controle_app;',
    'alter table app.conta add constraint conta_ck check (saldo >= 0) not valid;',
    'create or replace function app.f() returns int language sql as $$ select 1 $$;',
  ])('%s', (sql) => {
    expect(motivos(sql)).toEqual([]);
  });

  it('NOT NULL sem default numa tabela criada na MESMA migration é aditivo', () => {
    const sql = `create table app.nova (id uuid primary key);
alter table app.nova add column nome text not null;
alter table nova alter column nome set not null;`;
    expect(motivos(sql)).toEqual([]);
  });

  it('palavras dentro de comentário não contam', () => {
    const sql = `-- aqui não se faz drop table nem rename
/* nem alter column x type int; nem truncate */
create table app.x (id int);`;
    expect(motivos(sql)).toEqual([]);
  });

  it('identificadores que só contêm a palavra (drop_em, renomeado) não contam', () => {
    expect(motivos('alter table app.conta add column drop_em timestamptz, add column renomeado bool;')).toEqual([]);
  });
});

describe('o que não é aditivo é recusado', () => {
  it.each([
    ['drop table app.conta;', 'drop'],
    ['drop table if exists app.conta cascade;', 'drop'],
    ['alter table app.conta drop column nome;', 'drop'],
    ['alter table app.conta drop nome;', 'drop'],
    ['alter table app.conta alter column nome drop default;', 'drop'],
    ['alter table app.conta drop constraint conta_ck;', 'drop'],
    ['drop index app.conta_nome;', 'drop'],
    ['drop function app.f();', 'drop'],
    ['drop policy conta_select on app.conta;', 'drop'],
    ['drop schema app cascade;', 'drop'],
    ['DROP TABLE "app"."conta";', 'drop'],
    ['alter table app.conta rename to contas;', 'rename'],
    ['alter table app.conta rename column nome to titulo;', 'rename'],
    ['alter table app.conta rename nome to titulo;', 'rename'],
    ['alter table app.conta rename constraint a to b;', 'rename'],
    ["alter type app.situacao rename value 'a' to 'b';", 'rename'],
    ['alter table app.conta alter column saldo type bigint;', 'alter_type'],
    ['alter table app.conta alter column saldo set data type numeric(12,2);', 'alter_type'],
    ['alter table app.conta alter saldo type bigint using saldo::bigint;', 'alter_type'],
    ['ALTER TABLE app.conta ALTER COLUMN "saldo" TYPE bigint;', 'alter_type'],
    ['alter type app.endereco alter attribute rua type varchar(80);', 'alter_type'],
    ['alter table app.conta add column apelido text not null;', 'not_null_sem_default'],
    ['alter table app.conta add apelido text not null;', 'not_null_sem_default'],
    ['alter table if exists app.conta add column if not exists apelido text not null;', 'not_null_sem_default'],
    ['alter table app.conta alter column nome set not null;', 'set_not_null'],
    ['truncate app.conta;', 'truncate'],
    ['truncate table app.conta restart identity;', 'truncate'],
  ])('%s → %s', (sql, motivo) => {
    expect(motivos(sql)).toEqual([motivo]);
  });

  it('cada cláusula de um ALTER TABLE com vírgulas é avaliada (default numa coluna não salva a outra)', () => {
    const sql = 'alter table app.conta add column a int not null default 0, add column b int not null;';
    expect(motivos(sql)).toEqual(['not_null_sem_default']);
  });

  it('SQL dinâmico dentro de bloco DO ($$) e de string também é varrido', () => {
    expect(motivos("do $$ begin execute 'drop table app.conta'; end $$;")).toEqual(['drop']);
    expect(motivos('do $corpo$ begin alter table app.conta rename to x; end $corpo$;')).toEqual(['rename']);
  });

  it('informa o arquivo e a linha onde o comando começa', () => {
    const sql = `create table app.a (id int);

-- comentário
alter table app.conta
  drop column nome;`;
    const [v] = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx()).violacoes;
    expect(v).toMatchObject({ arquivo: '20261103000000_c.sql', linha: 4, motivo: 'drop' });
  });

  it('um ; dentro de string, identificador ou $$ não corta o comando', () => {
    const sql = `comment on table app.a is 'um; dois';
create function app.g() returns void language plpgsql as $$ begin perform 1; perform 2; end $$;
alter table app.conta drop column x;`;
    const [v] = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx()).violacoes;
    expect(v).toMatchObject({ linha: 3, motivo: 'drop' });
  });
});

describe('exceção explícita e auditável', () => {
  const JUST = 'coluna substituída por nome_exibicao na fase expand';

  it('expand=<migration mais antiga que existe> libera o comando seguinte e fica listada', () => {
    const sql = `-- migracao-nao-aditiva: expand=20261101000000_a.sql | ${JUST}
alter table app.conta drop column nome;`;
    const r = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx());
    expect(r.violacoes).toEqual([]);
    expect(r.erros).toEqual([]);
    expect(r.excecoes).toEqual([
      expect.objectContaining({
        arquivo: '20261103000000_c.sql',
        linha: 2,
        motivos: ['drop'],
        tipo: 'expand',
        referencia: '20261101000000_a.sql',
        justificativa: JUST,
      }),
    ]);
  });

  it('expand que não existe, que é a própria migration ou mais nova é recusada', () => {
    for (const ref of ['20261099000000_inexistente.sql', '20261103000000_c.sql', '20261104000000_d.sql']) {
      const sql = `-- migracao-nao-aditiva: expand=${ref} | ${JUST}\nalter table app.conta drop column nome;`;
      const r = analisarMigracao(
        { arquivo: '20261103000000_c.sql', sql },
        ctx({ arquivos: [...ctx().arquivos, '20261104000000_d.sql'] }),
      );
      expect(r.erros.length, ref).toBe(1);
      expect(r.violacoes.map((v) => v.motivo)).toEqual(['drop']);
    }
  });

  it('expand que ainda não estava na base (mesmo PR ou push) é recusada: a fase expand precisa já ter sido publicada', () => {
    const sql = `-- migracao-nao-aditiva: expand=20261102000000_b.sql | ${JUST}\nalter table app.conta drop column nome;`;
    const naBase = (arquivo: string) => arquivo !== '20261102000000_b.sql';
    const r = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx({ existeNaBase: naBase }));
    expect(r.erros).toEqual([expect.stringContaining('não estava publicada')]);
    expect(r.violacoes).toHaveLength(1);
    const ok = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx({ existeNaBase: () => true }));
    expect(ok.erros).toEqual([]);
    expect(ok.violacoes).toEqual([]);
  });

  it('log exige linha APROVADA no Log de Alterações com G-43 e o nome da migration, e com validade', () => {
    const sql = `-- migracao-nao-aditiva: log | ${JUST}\ntruncate app.webhook_evento;`;
    const semLinha = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx());
    expect(semLinha.erros).toEqual([expect.stringContaining('Log de Alterações')]);
    expect(semLinha.violacoes).toHaveLength(1);

    const pendente = `${LOG_VAZIO}| 2026-11-03 | dev | — (pendente) | G-43: exceção em 20261103000000_c.sql | x | até 2026-12-01 |\n`;
    expect(
      analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx({ logGuardrails: pendente })).erros,
    ).toHaveLength(1);

    const semValidade = `${LOG_VAZIO}| 2026-11-03 | dev | Leandro | G-43: exceção em 20261103000000_c.sql | x | — |\n`;
    expect(
      analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx({ logGuardrails: semValidade })).erros,
    ).toHaveLength(1);

    const aprovado = `${LOG_VAZIO}| 2026-11-03 | dev | Leandro | G-43: exceção em 20261103000000_c.sql | x | até 2026-12-01 |\n`;
    const r = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx({ logGuardrails: aprovado }));
    expect(r.erros).toEqual([]);
    expect(r.violacoes).toEqual([]);
    expect(r.excecoes[0]).toMatchObject({ tipo: 'log', motivos: ['truncate'] });
  });

  it('a linha do Log tem de estar na tabela do Log de Alterações (outra tabela do documento não vale)', () => {
    const doc = `## Outra seção\n\n| a | b | c | d | e | f |\n|---|---|---|---|---|---|\n| 2026-11-03 | dev | Leandro | G-43 20261103000000_c.sql | x | até 2026-12-01 |\n\n${LOG_VAZIO}`;
    expect(linhaDoLogAprovada(doc, '20261103000000_c.sql')).toBe(false);
  });

  it('justificativa curta (menos de 20 caracteres) ou formato errado é recusado', () => {
    for (const anotacao of [
      '-- migracao-nao-aditiva: expand=20261101000000_a.sql | curta',
      '-- migracao-nao-aditiva: expand=20261101000000_a.sql',
      `-- migracao-nao-aditiva: porque sim | ${JUST}`,
      `-- migracao-nao-aditiva ${JUST}`,
    ]) {
      const r = analisarMigracao({ arquivo: '20261103000000_c.sql', sql: `${anotacao}\ndrop table app.x;` }, ctx());
      expect(r.erros.length, anotacao).toBe(1);
      expect(r.violacoes, anotacao).toHaveLength(1);
    }
  });

  it('a exceção vale só para o comando seguinte, não para os outros', () => {
    const sql = `-- migracao-nao-aditiva: expand=20261101000000_a.sql | ${JUST}
alter table app.conta drop column nome;
alter table app.conta drop column apelido;`;
    const r = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx());
    expect(r.violacoes).toEqual([expect.objectContaining({ linha: 3, motivo: 'drop' })]);
  });

  it('exceção sem comando não aditivo depois dela é erro (não fica exceção sobrando)', () => {
    const sql = `-- migracao-nao-aditiva: expand=20261101000000_a.sql | ${JUST}
alter table app.conta add column apelido text;`;
    const r = analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx());
    expect(r.erros).toEqual([expect.stringContaining('não precede')]);
  });

  it('a anotação dentro de bloco /* */ ou no meio de uma string não vale', () => {
    const sql = `/* -- migracao-nao-aditiva: expand=20261101000000_a.sql | ${JUST} */
drop table app.x;`;
    expect(analisarMigracao({ arquivo: '20261103000000_c.sql', sql }, ctx()).violacoes).toHaveLength(1);
  });
});

describe('ci.yml', () => {
  const ci = readFileSync(join(RAIZ, '.github/workflows/ci.yml'), 'utf8').replace(/^\s*#.*$/gm, '');
  const scripts = JSON.parse(readFileSync(join(RAIZ, 'backend/scripts/package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  it('roda o passo no job base, antes do lint, contra o commit de base do PR ou do push', () => {
    expect(scripts.scripts['migracoes-aditivas']).toBe('tsx src/operacao/migracao-aditiva.ts');
    const base = ci.slice(ci.indexOf('  base:'), ci.indexOf('  banco:'));
    expect(base).toMatch(/fetch-depth: 0/);
    expect(base).toMatch(/BASE: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}/);
    expect(base).toMatch(/run: pnpm --filter @controle\/scripts migracoes-aditivas --base "\$BASE"/);
    expect(base.indexOf('migracoes-aditivas')).toBeLessThan(base.indexOf('pnpm lint'));
    expect(base).not.toMatch(/continue-on-error/);
  });
});

describe('main (CLI do CI)', () => {
  const pastaFalsa = (arquivos: Record<string, string>) => ({
    listar: () => Object.keys(arquivos),
    ler: (a: string) => arquivos[a]!,
    guardrails: () => LOG_VAZIO,
  });

  it('sai 0 sem violação e 1 com violação, apontando arquivo:linha e o que fazer', async () => {
    const saida: string[] = [];
    const log = (l: string) => saida.push(l);
    expect(await main([], pastaFalsa({ '20261101000000_a.sql': 'create table app.a (id int);' }), log)).toBe(0);
    const codigo = await main([], pastaFalsa({ '20261101000000_a.sql': 'drop table app.a;' }), log);
    expect(codigo).toBe(1);
    expect(saida.join('\n')).toContain('20261101000000_a.sql:1');
    expect(saida.join('\n')).toContain('migracao-nao-aditiva');
  });

  it('--base <sha> confere a expand na base; sem base (ou sha zerado) avisa e só confere a ordem', async () => {
    const sql = `-- migracao-nao-aditiva: expand=20261101000000_a.sql | ${'x'.repeat(25)}\ndrop table app.a;`;
    const pasta = pastaFalsa({ '20261101000000_a.sql': 'create table app.a (id int);', '20261102000000_b.sql': sql });
    const consultas: string[] = [];
    const naBase = (ref: string, caminho: string) => {
      consultas.push(`${ref}:${caminho}`);
      return false;
    };
    expect(await main(['--base', 'abc123'], pasta, () => {}, naBase)).toBe(1);
    expect(consultas).toEqual(['abc123:backend/scripts/migracoes/20261101000000_a.sql']);
    const saida: string[] = [];
    expect(await main(['--base', '0'.repeat(40)], pasta, (l) => saida.push(l), naBase)).toBe(0);
    expect(saida.join('\n')).toContain('sem commit de base');
  });
});
