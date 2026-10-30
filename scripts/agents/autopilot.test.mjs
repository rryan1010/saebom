// Tests for the autopilot (D67) against a local "GitHub": a bare origin repo and a stub gh.
// Run: node --test "scripts/agents/*.test.*"
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./autopilot.sh', import.meta.url));
const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const handoff = (items) =>
  [
    '# Handoff',
    '## 14. Build schedule',
    ...items,
    '## 15. Before inviting testers',
    '- [ ] not §14',
  ].join('\n');

/** A bare origin, the owner's main checkout, a second clone that "merges", and a stub gh. */
function world() {
  const dir = mkdtempSync(join(tmpdir(), 'saebom-autopilot-'));
  const git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV } });
  git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  git(dir, 'clone', '-q', join(dir, 'origin.git'), 'dev');
  const dev = join(dir, 'dev');
  mkdirSync(join(dev, 'docs'));
  const merge = (items, message) => {
    writeFileSync(join(dev, 'docs', 'HANDOFF.md'), handoff(items));
    git(dev, 'add', '-A');
    git(dev, 'commit', '-q', '--allow-empty', '-m', message);
    git(dev, 'push', '-q', 'origin', 'HEAD:main');
  };
  merge(['- [x] tooling', '- [ ] theme tokens'], 'chore: start');
  git(dir, 'clone', '-q', join(dir, 'origin.git'), 'main');
  const stub = join(dir, 'stub');
  const bin = join(dir, 'bin');
  mkdirSync(stub);
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'gh'),
    [
      '#!/bin/sh',
      'case "$1 $2" in',
      '  "pr list") cat "$STUB_DIR/prs" 2>/dev/null ;;',
      '  "pr view") cat "$STUB_DIR/review-$3" 2>/dev/null || echo 0 ;;',
      '  "issue list") cat "$STUB_DIR/questions" 2>/dev/null ;;',
      'esac',
    ].join('\n'),
  );
  chmodSync(join(bin, 'gh'), 0o755);
  /** Checks once by default; with keys, it runs the key loop on them (end them with q). */
  const run = (keys) => {
    const result = spawnSync('bash', [SCRIPT], {
      cwd: join(dir, 'main'),
      encoding: 'utf8',
      input: keys ?? '',
      timeout: 60_000,
      env: {
        ...process.env,
        ...GIT_ENV,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        STUB_DIR: stub,
        AUTOPILOT_DRY_RUN: '1',
        AUTOPILOT_INTERVAL: '1',
        ...(keys === undefined ? { AUTOPILOT_ONCE: '1' } : {}),
      },
    });
    return { status: result.status, out: `${result.stdout}${result.stderr}` };
  };
  return { dir, stub, merge, run };
}

test('the first run only starts watching', () => {
  const w = world();
  const first = w.run();
  assert.equal(first.status, 0);
  assert.match(first.out, /Watching main at [0-9a-f]+ chore: start/);
  assert.match(first.out, /Unchecked §14 items: 1\./);
  assert.doesNotMatch(first.out, /Dry run/);
  rmSync(w.dir, { recursive: true, force: true });
});

test('a merge with no open PR starts the next task', () => {
  const w = world();
  w.run();
  w.merge(['- [x] tooling', '- [ ] theme tokens', '- [ ] migrations'], 'feat(db): add tables (#3)');
  const second = w.run();
  assert.match(second.out, /main moved: [0-9a-f]+ feat\(db\): add tables \(#3\)/);
  assert.match(second.out, /Dry run: would open a session in worktree next-\d{4}-\d{4}/);
  assert.match(second.out, /claude -w next-/);
  assert.match(second.out, /pstack:poteto-mode Take the next task from §14/);
  assert.equal(w.run().out.includes('Dry run'), false, 'no second start without another merge');
  rmSync(w.dir, { recursive: true, force: true });
});

test('waits while a PR is open, and reports PRs, reviews and questions once', () => {
  const w = world();
  writeFileSync(join(w.stub, 'prs'), '7\tfeat(app): add theme tokens\n');
  writeFileSync(join(w.stub, 'questions'), '12\tQ: which accent color?\n');
  const first = w.run();
  assert.match(first.out, /PR #7 opened: feat\(app\): add theme tokens/);
  assert.match(first.out, /Question #12 needs your answer: Q: which accent color\?/);
  writeFileSync(join(w.stub, 'review-7'), '1\n');
  w.merge(['- [x] tooling', '- [ ] theme tokens', '- [ ] ci'], 'docs: something else');
  const second = w.run();
  assert.match(second.out, /PR #7 is ready for your review/);
  assert.match(second.out, /Waiting: 1 pull request\(s\) still open/);
  assert.doesNotMatch(second.out, /Dry run/);
  assert.doesNotMatch(second.out, /PR #7 opened/, 'reported once');
  assert.doesNotMatch(second.out, /Question #12 needs/, 'reported once');
  rmSync(w.dir, { recursive: true, force: true });
});

test('waits while an autopilot session is still running', async () => {
  const w = world();
  w.run();
  const session = spawn('bash', ['-c', 'exec -a "claude -w next-test" sleep 30'], {
    stdio: 'ignore',
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    w.merge(['- [ ] theme tokens', '- [ ] ci'], 'feat: merged while a session runs');
    const out = w.run().out;
    assert.match(out, /Waiting: an autopilot session is still running/);
    assert.doesNotMatch(out, /Dry run/);
  } finally {
    session.kill();
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test('stops when every §14 item is ticked', () => {
  const w = world();
  w.run();
  w.merge(['- [x] tooling', '- [x] theme tokens'], 'feat: the last item');
  const done = w.run();
  assert.equal(done.status, 0);
  assert.match(done.out, /Every §14 item is ticked\. Autopilot is done\./);
  assert.doesNotMatch(done.out, /Dry run/);
  rmSync(w.dir, { recursive: true, force: true });
});

const starts = (out) => out.match(/Dry run: would open/g)?.length ?? 0;

test('a restart says what it is watching', () => {
  const w = world();
  w.run();
  const again = w.run();
  assert.match(again.out, /Watching main at [0-9a-f]+ chore: start\./);
  assert.equal(starts(again.out), 0);
  rmSync(w.dir, { recursive: true, force: true });
});

test('Enter starts a task, but not a second one within 2 minutes', () => {
  const w = world();
  const out = w.run('\n\nq').out;
  assert.match(out, /Waiting for your next merge/);
  assert.equal(starts(out), 1);
  assert.match(out, /Not starting: a task started less than 2 minutes ago\. Press f/);
  assert.match(out, /Autopilot stopped\./);
  rmSync(w.dir, { recursive: true, force: true });
});

test('Enter waits while a PR is open, and f starts a task anyway', () => {
  const w = world();
  writeFileSync(join(w.stub, 'prs'), '7\tfeat(app): add theme tokens\n');
  const out = w.run('\nfq').out;
  assert.match(out, /Not starting: 1 pull request\(s\) still open\. Press f/);
  assert.equal(starts(out), 1);
  rmSync(w.dir, { recursive: true, force: true });
});

test('other keys are ignored', () => {
  const w = world();
  const out = w.run('npm run autopilotq').out;
  assert.equal(starts(out), 0);
  assert.match(out, /Autopilot stopped\./);
  rmSync(w.dir, { recursive: true, force: true });
});

test('refuses to run outside the repo', () => {
  const outside = mkdtempSync(join(tmpdir(), 'saebom-outside-'));
  const result = spawnSync('bash', [SCRIPT], { cwd: outside, encoding: 'utf8', input: '' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Run this inside the saebom repo/);
  rmSync(outside, { recursive: true, force: true });
});
