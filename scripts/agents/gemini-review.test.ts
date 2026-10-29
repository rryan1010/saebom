// Tests for the Gemini second-review script (D63). Run: node --test "scripts/agents/*.test.*"
import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildPrompt, findSecret, run } from './gemini-review.ts';

const CLEAN_DIFF = [
  'diff --git a/supabase/functions/_shared/rules/reps.ts b/supabase/functions/_shared/rules/reps.ts',
  '--- a/supabase/functions/_shared/rules/reps.ts',
  '+++ b/supabase/functions/_shared/rules/reps.ts',
  '@@ -1,1 +1,2 @@',
  '+export const MAX_REPS = 12;',
].join('\n');

/** A temp folder with stub `agy` and `gh` programs on its PATH. */
function sandbox(diff: string) {
  const dir = mkdtempSync(join(tmpdir(), 'saebom-review-'));
  writeFileSync(join(dir, 'diff.txt'), diff);
  writeFileSync(
    join(dir, 'gh'),
    [
      '#!/bin/sh',
      'if [ "$2" = view ]; then echo \'{"title":"feat(plan): add rep caps","body":"Why: D48","headRefOid":"abcdef1234567"}\'; fi',
      `if [ "$2" = diff ]; then cat "${join(dir, 'diff.txt')}"; fi`,
    ].join('\n'),
  );
  writeFileSync(
    join(dir, 'agy'),
    [
      '#!/bin/sh',
      `printf '%s\\n' "$@" > "${join(dir, 'agy-args.txt')}"`,
      'if [ -n "$STUB_AUTH" ]; then echo "Error: authentication required" >&2; exit 1; fi',
      'if [ -n "$STUB_FALLBACK" ]; then echo \'model gemini-4-argon is not recognized as a known model or custom model in settings. Using "Gemini 3.8 Flash (High)" instead.\' >&2; fi',
      'echo "NO FINDINGS"',
    ].join('\n'),
  );
  chmodSync(join(dir, 'gh'), 0o755);
  chmodSync(join(dir, 'agy'), 0o755);
  const env = { PATH: `${dir}:${process.env.PATH ?? ''}`, HOME: dir };
  const output = { out: '', err: '' };
  const options = {
    cwd: dir,
    env,
    out: (s: string) => void (output.out += s),
    err: (s: string) => void (output.err += s),
  };
  return { dir, env, output, options };
}

test('findSecret refuses secret files and secret-looking lines', () => {
  assert.equal(findSecret(CLEAN_DIFF), null);
  assert.match(
    findSecret('diff --git a/app/.env.local b/app/.env.local\n+X=1') ?? '',
    /app\/\.env\.local/,
  );
  assert.equal(
    findSecret('diff --git a/app/.env.example b/app/.env.example\n+EXPO_PUBLIC_SUPABASE_URL='),
    null,
  );
  assert.match(
    findSecret(`${CLEAN_DIFF}\n+const key = "sb_secret_abcdefghijklmnop";`) ?? '',
    /Supabase secret/,
  );
  assert.match(findSecret(`${CLEAN_DIFF}\n+-----BEGIN PRIVATE KEY-----`) ?? '', /private key/);
  assert.equal(
    findSecret(`${CLEAN_DIFF}\n-const key = "sb_secret_abcdefghijklmnop";`),
    null,
    'removed lines are fine',
  );
  assert.match(
    findSecret(CLEAN_DIFF, 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789') ?? '',
    /PR text/,
  );
  assert.match(
    findSecret('diff --git a/keys/AuthKey_X.p8 b/keys/AuthKey_X.p8') ?? '',
    /AuthKey_X\.p8/,
  );
});

test('buildPrompt carries the PR and the review bar', () => {
  const prompt = buildPrompt({ title: 'feat: x', body: '', diff: CLEAN_DIFF });
  assert.match(prompt, /Pull request title: feat: x/);
  assert.match(prompt, /\(none\)/);
  assert.match(prompt, /NO FINDINGS/);
  assert.ok(prompt.includes(CLEAN_DIFF));
});

test('reviews a PR and writes the review file', () => {
  const box = sandbox(CLEAN_DIFF);
  assert.equal(run(['12'], box.options), 0);
  assert.match(box.output.out, /NO FINDINGS/);
  assert.match(box.output.out, /Model asked for: gemini-4-argon \(effort high\)/);
  assert.doesNotMatch(box.output.out, /Model used/);
  const file = join(box.dir, '.agents', 'reviews', 'pr-12-abcdef1.md');
  assert.ok(existsSync(file));
  const args = readFileSync(join(box.dir, 'agy-args.txt'), 'utf8');
  assert.match(args, /^-p$/m);
  assert.match(args, /^--effort\nhigh$/m);
  assert.match(args, /export const MAX_REPS = 12;/);
});

test('reports the model Antigravity actually used', () => {
  const box = sandbox(CLEAN_DIFF);
  assert.equal(run(['12'], { ...box.options, env: { ...box.env, STUB_FALLBACK: '1' } }), 0);
  assert.match(box.output.out, /Model used: Gemini 3\.8 Flash \(High\)/);
});

test('refuses before sending anything when the diff holds a secret', () => {
  const box = sandbox(`${CLEAN_DIFF}\n+SUPABASE_SECRET_KEY=sb_secret_abcdefghijklmnop`);
  assert.equal(run(['12'], box.options), 2);
  assert.match(box.output.err, /Nothing was sent to Gemini/);
  assert.equal(existsSync(join(box.dir, 'agy-args.txt')), false);
});

test('fails clearly when agy is signed out or missing', () => {
  const signedOut = sandbox(CLEAN_DIFF);
  assert.equal(run(['12'], { ...signedOut.options, env: { ...signedOut.env, STUB_AUTH: '1' } }), 3);
  assert.match(signedOut.output.err, /signed out/);
  const missing = sandbox(CLEAN_DIFF);
  assert.equal(
    run(['12'], {
      ...missing.options,
      env: { ...missing.env, AGY_BIN: join(missing.dir, 'nope') },
    }),
    3,
  );
  assert.match(missing.output.err, /not installed/);
});

test('keeps effort at medium or above and needs a target', () => {
  const box = sandbox(CLEAN_DIFF);
  assert.equal(
    run(['12'], { ...box.options, env: { ...box.env, GEMINI_REVIEW_EFFORT: 'low' } }),
    4,
  );
  assert.match(box.output.err, /never goes below medium/);
  assert.equal(run([], box.options), 4);
});

test('reviews a local diff file before a PR exists', () => {
  const box = sandbox(CLEAN_DIFF);
  assert.equal(run(['--diff-file', 'diff.txt', '--title', 'wip'], box.options), 0);
  const reviews = readdirSync(join(box.dir, '.agents', 'reviews'));
  assert.equal(reviews.length, 1);
  assert.match(reviews[0] ?? '', /^local-/);
});
