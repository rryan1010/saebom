import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../supabase/functions/_shared/rules/catalog.ts';
import type { Exercise } from '../supabase/functions/_shared/rules/types.ts';
import { SEED_PATH, catalogSeedSql } from './seed-catalog.ts';

const first = CATALOG[0] as Exercise;

describe('catalogSeedSql', () => {
  it('matches the committed supabase/seed.sql', () => {
    expect(
      readFileSync(SEED_PATH, 'utf8'),
      'supabase/seed.sql is out of date: run `npm run db:seed` and commit the result',
    ).toBe(catalogSeedSql(CATALOG));
  });

  it('doubles an apostrophe inside a string literal', () => {
    const sql = catalogSeedSql([{ ...first, cues: ["Don't round your back", 'Brace first'] }]);
    expect(sql).toContain(`'Don''t round your back'`);
    expect(sql).not.toContain(`'Don't`);
  });

  it('writes empty arrays and a missing light muscle in forms postgres accepts', () => {
    const sql = catalogSeedSql([
      { ...first, muscleLight: null, regionsLight: [], allowedSwaps: [] },
    ]);
    expect(sql).toContain('array[]::text[]');
    expect(sql).toMatch(/'legs', null,/);
  });
});
