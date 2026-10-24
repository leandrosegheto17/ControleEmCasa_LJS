import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../init-local.sql', import.meta.url), 'utf8');

describe('init-local.sql (SDD 11.3)', () => {
  it('cria os papéis controle_app e controle_backup_ro', () => {
    expect(sql).toMatch(/CREATE ROLE controle_app /);
    expect(sql).toMatch(/CREATE ROLE controle_backup_ro /);
  });
  it('nenhum papel tem BYPASSRLS nem SUPERUSER', () => {
    expect(sql).not.toMatch(/(?<!NO)BYPASSRLS/);
    expect(sql).not.toMatch(/(?<!NO)SUPERUSER/);
  });
});
