// Second review by Gemini through Antigravity CLI (D63). Runs on Node 24 (.nvmrc).
//
//   node scripts/agents/gemini-review.ts <pr-number>
//   node scripts/agents/gemini-review.ts --diff-file <path> [--title <text>]
//
// Sends Gemini only the diff and the PR's title and description, after checking
// that none of them looks like it holds a secret. The review is written to
// .agents/reviews/ (git-ignored) and printed; the second-review skill triages it
// and posts the result on the PR.
//
// Environment: GEMINI_REVIEW_MODEL (default gemini-4-argon), GEMINI_REVIEW_EFFORT
// (default high; never below medium, D64), AGY_BIN (default agy), GH_BIN (default gh).
//
// Exit codes: 0 review written · 2 refused: something looks like a secret ·
// 3 Antigravity CLI missing, signed out or failed · 4 bad arguments or a diff too big.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_PROMPT_BYTES = 600_000; // agy -p takes the prompt as an argument; macOS caps arguments near 1 MB
const TIMEOUT_MS = 15 * 60 * 1000;
const EFFORTS = ['medium', 'high', 'xhigh', 'max'];

const SECRET_FILE = /(^|\/)(\.env(\.[\w-]+)*|[^/]+\.(p8|p12|mobileprovision))$/;
const SECRET_TEXT: ReadonlyArray<readonly [RegExp, string]> = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'a Supabase secret key'],
  [
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    'a JWT, such as a service-role key',
  ],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/AGE-SECRET-KEY-1[0-9A-Z]{20,}/, 'an age private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'a GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, 'a GitHub token'],
  [/\bAIza[0-9A-Za-z_-]{35}/, 'a Google API key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key'],
];

/** Returns why the text can't go to Gemini, or null when it looks clean. */
export function findSecret(diff: string, prText = ''): string | null {
  for (const line of diff.split('\n')) {
    const header = /^diff --git a\/(\S+) b\/(\S+)/.exec(line);
    if (header) {
      for (const path of [header[1] ?? '', header[2] ?? '']) {
        if (SECRET_FILE.test(path) && !/(^|\/)\.env\.example$/.test(path))
          return `the diff touches ${path}`;
      }
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    for (const [pattern, what] of SECRET_TEXT) {
      if (pattern.test(line)) return `an added line looks like ${what}`;
    }
  }
  for (const [pattern, what] of SECRET_TEXT) {
    if (pattern.test(prText)) return `the PR text looks like it holds ${what}`;
  }
  return null;
}

export function buildPrompt(pr: { title: string; body: string; diff: string }): string {
  return [
    'You are the second reviewer for a pull request in Saebom, an invite-only iPhone app for gym',
    'weightlifting (Expo and React Native, Supabase with row-level security, Deno Edge Functions).',
    'Another model wrote this change. AGENTS.md holds the repo rules and docs/HANDOFF.md the spec;',
    'read the parts you need.',
    '',
    'Review only: do not edit files, run commands, push, or comment anywhere.',
    '',
    'Report problems you can point to in the diff:',
    '1. Bugs: wrong behavior, broken edge cases, unhandled errors, races.',
    '2. AGENTS.md rules: secrets or health data in code, logs, notifications, audit events or AI prompts;',
    '   a table without RLS, the "mfa or demo" policy, explicit grants or pgTAP tests; a function that',
    '   skips the aal2 check or input validation; the app writing tables other than profiles and consents.',
    '3. Plan engine invariants: reps never above 12, and never above 10 without an injured area; weights',
    '   on the increment and at or above the minimum load; at most one increment up per session; no',
    '   deadlift for new lifters; areas trained around never loaded; the light-exercise rules (D47).',
    '4. Tests: new behavior without a test, a test of implementation details instead of behavior, or a',
    '   skipped, deleted or loosened test.',
    '5. Accessibility: a ring or button without an accessibilityLabel, motion that ignores Reduce Motion.',
    'Skip style, naming and formatting; Prettier and the linters own those.',
    '',
    'Answer in this format, most severe first:',
    '### F1 · blocker|major|minor · path:line',
    'Problem: one or two sentences.',
    'Evidence: the diff lines that show it.',
    'Rule: the AGENTS.md rule, handoff section or decision (D-number) it breaks, if any.',
    '',
    'If nothing meets that bar, answer exactly: NO FINDINGS',
    '',
    `Pull request title: ${pr.title}`,
    'Pull request description:',
    pr.body.trim() || '(none)',
    '',
    'Diff:',
    '```diff',
    pr.diff,
    '```',
  ].join('\n');
}

type Options = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  out: (s: string) => void;
  err: (s: string) => void;
};

export function run(argv: readonly string[], options: Partial<Options> = {}): number {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const out = options.out ?? ((s: string) => process.stdout.write(s));
  const err = options.err ?? ((s: string) => process.stderr.write(s));
  const gh = env.GH_BIN ?? 'gh';
  const agy = env.AGY_BIN ?? 'agy';
  const model = env.GEMINI_REVIEW_MODEL ?? 'gemini-4-argon';
  const effort = env.GEMINI_REVIEW_EFFORT ?? 'high';

  if (!EFFORTS.includes(effort)) {
    err(
      `GEMINI_REVIEW_EFFORT must be one of ${EFFORTS.join(', ')}; effort never goes below medium (D64).\n`,
    );
    return 4;
  }

  let title = '';
  let body = '';
  let diff = '';
  let label = '';
  const prIndex = argv.findIndex((a) => /^\d+$/.test(a));
  const diffFlag = argv.indexOf('--diff-file');
  try {
    if (prIndex !== -1) {
      const pr = argv[prIndex] ?? '';
      const view = JSON.parse(
        execFileSync(gh, ['pr', 'view', pr, '--json', 'title,body,headRefOid'], {
          cwd,
          env,
          encoding: 'utf8',
        }),
      ) as { title?: string; body?: string; headRefOid?: string };
      title = view.title ?? '';
      body = view.body ?? '';
      diff = execFileSync(gh, ['pr', 'diff', pr], {
        cwd,
        env,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      label = `pr-${pr}-${(view.headRefOid ?? 'unknown').slice(0, 7)}`;
    } else if (diffFlag !== -1 && argv[diffFlag + 1]) {
      diff = readFileSync(resolve(cwd, argv[diffFlag + 1] ?? ''), 'utf8');
      const titleFlag = argv.indexOf('--title');
      title = titleFlag !== -1 ? (argv[titleFlag + 1] ?? '') : '(local diff, no PR yet)';
      label = `local-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    } else {
      err(
        'Usage: node scripts/agents/gemini-review.ts <pr-number> | --diff-file <path> [--title <text>]\n',
      );
      return 4;
    }
  } catch (error) {
    err(
      `Could not read the pull request: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 4;
  }

  const secret = findSecret(diff, `${title}\n${body}`);
  if (secret) {
    err(
      `Refused: ${secret}. Nothing was sent to Gemini. Remove it from the branch before review (CLAUDE.md, Rules).\n`,
    );
    return 2;
  }
  if (diff.trim() === '') {
    err('The diff is empty; there is nothing to review.\n');
    return 4;
  }

  const prompt = buildPrompt({ title, body, diff });
  if (Buffer.byteLength(prompt) > MAX_PROMPT_BYTES) {
    err('The diff is too large for one review. Split the PR into smaller ones (D62).\n');
    return 4;
  }

  const result = spawnSync(
    agy,
    ['-p', prompt, '--model', model, '--effort', effort, '--output-format', 'text'],
    {
      cwd,
      env,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const stderr = result.stderr ?? '';
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    err(
      code === 'ENOENT'
        ? 'Antigravity CLI (agy) is not installed or not on PATH. See Setup in docs/agent-workflow.md.\n'
        : `Antigravity CLI failed to run: ${result.error.message}\n`,
    );
    return 3;
  }
  if (/authentication required/i.test(stderr)) {
    err(
      'Antigravity CLI is signed out. Run `agy` once in a terminal and sign in with your Google AI Pro account.\n',
    );
    return 3;
  }
  const review = (result.stdout ?? '').trim();
  if (result.status !== 0 || review === '') {
    err(
      `Antigravity CLI exited with status ${result.status ?? 'unknown'}.\n${stderr.slice(-2000)}\n`,
    );
    return 3;
  }

  const fallback = /not recognized as a known model[^\n]*?Using "([^"]+)" instead/i.exec(stderr);
  const header = [
    '# Second review · Gemini through Antigravity CLI',
    '',
    `- Change: ${title}`,
    `- Model asked for: ${model} (effort ${effort})`,
    ...(fallback
      ? [`- Model used: ${fallback[1]}; Antigravity did not recognize ${model} (see agy models)`]
      : []),
    `- Reviewed: ${new Date().toISOString()}`,
    '',
  ].join('\n');
  const dir = join(cwd, '.agents', 'reviews');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${label}.md`);
  writeFileSync(file, `${header}\n${review}\n`);
  err(`Review written to ${file}\n`);
  out(`${header}\n${review}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
