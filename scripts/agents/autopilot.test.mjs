// Tests for the autopilot (D67, D69) against a local "GitHub": a bare origin repo and a stub gh.
// Run: node --test "scripts/agents/*.test.*"
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  merge(
    ['- [x] tooling', '- [ ] **Backend:** catalog seed', '- [ ] **App:** sign-in screens'],
    'chore: start',
  );
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
  const run = (keys, extraEnv = {}) => {
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
        ...extraEnv,
      },
    });
    return { status: result.status, out: `${result.stdout}${result.stderr}` };
  };
  return { dir, stub, merge, run };
}

const starts = (out) => out.match(/Dry run: would open/g)?.length ?? 0;
const startsIn = (out, lane) =>
  out.match(new RegExp(`Dry run: would open a ${lane} session`, 'g'))?.length ?? 0;

test('the first run only starts watching', () => {
  const w = world();
  const first = w.run();
  assert.equal(first.status, 0);
  assert.match(first.out, /Watching main at [0-9a-f]+ chore: start/);
  assert.match(first.out, /Unchecked §14 items: app 1, backend 1, owner 0\./);
  assert.equal(starts(first.out), 0);
  rmSync(w.dir, { recursive: true, force: true });
});

test('a merge with no open PR starts a session in each lane', () => {
  const w = world();
  w.run();
  w.merge(
    ['- [x] tooling', '- [ ] **Backend:** catalog seed', '- [ ] **App:** sign-in screens'],
    'feat(db): add tables (#3)',
  );
  const second = w.run();
  assert.match(second.out, /main moved: [0-9a-f]+ feat\(db\): add tables \(#3\)/);
  assert.match(second.out, /worktree next-app-\d{4}-\d{4}/);
  assert.match(second.out, /worktree next-backend-\d{4}-\d{4}/);
  assert.equal(startsIn(second.out, 'app'), 1);
  assert.equal(startsIn(second.out, 'backend'), 1);
  assert.match(second.out, /pstack:poteto-mode You work the app lane \(D69\)/);
  assert.match(second.out, /unchecked \*\*App:\*\* items/);
  assert.match(second.out, /unchecked \*\*Backend:\*\* items/);
  assert.match(second.out, /Lane: backend, Review: and iPhone: lines/);
  assert.equal(starts(w.run().out), 0, 'no second start without another merge');
  rmSync(w.dir, { recursive: true, force: true });
});

test("a lane's open PR blocks only that lane, and reports PRs, reviews and questions once", () => {
  const w = world();
  writeFileSync(join(w.stub, 'prs'), '7\tbackend\tfeat(rules): add progression\n');
  writeFileSync(join(w.stub, 'questions'), '12\tQ: which accent color?\n');
  const first = w.run();
  assert.match(first.out, /PR #7 opened \(backend\): feat\(rules\): add progression/);
  assert.match(first.out, /Question #12 needs your answer: Q: which accent color\?/);
  writeFileSync(join(w.stub, 'review-7'), '1\n');
  w.merge(
    ['- [ ] **Backend:** catalog seed', '- [ ] **App:** sign-in screens', '- [ ] **App:** ci'],
    'docs: something else',
  );
  const second = w.run();
  assert.match(second.out, /PR #7 is ready for your review/);
  assert.match(second.out, /Waiting on the backend lane: 1 pull request\(s\) open for this lane\./);
  assert.equal(startsIn(second.out, 'backend'), 0);
  assert.equal(startsIn(second.out, 'app'), 1);
  assert.doesNotMatch(second.out, /PR #7 opened/, 'reported once');
  assert.doesNotMatch(second.out, /Question #12 needs/, 'reported once');
  rmSync(w.dir, { recursive: true, force: true });
});

test('a PR with no lane blocks both lanes', () => {
  const w = world();
  writeFileSync(join(w.stub, 'prs'), '9\tany\tdocs: speed up the agent loop\n');
  w.run();
  w.merge(['- [ ] **Backend:** catalog seed', '- [ ] **App:** sign-in screens'], 'feat: merged');
  const out = w.run().out;
  assert.match(out, /Waiting on the app lane: 1 pull request\(s\) open for this lane\./);
  assert.match(out, /Waiting on the backend lane: 1 pull request\(s\) open for this lane\./);
  assert.equal(starts(out), 0);
  rmSync(w.dir, { recursive: true, force: true });
});

test('a lane with no unchecked items starts nothing, and owner items are never taken', () => {
  const w = world();
  w.run();
  w.merge(
    ['- [x] **Backend:** catalog seed', '- [ ] **App:** sign-in screens', '- [ ] **Owner:** push'],
    'feat: backend done for now',
  );
  const out = w.run().out;
  assert.match(out, /Waiting on the backend lane: no unchecked items in this lane\./);
  assert.equal(startsIn(out, 'app'), 1);
  assert.equal(starts(out), 1);
  rmSync(w.dir, { recursive: true, force: true });
});

const spawnAs = async (name) => {
  const child = spawn('bash', ['-c', `exec -a "claude -w ${name}" sleep 30`], { stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 200));
  return child;
};

test("waits while a lane's session is still running", async () => {
  const w = world();
  w.run();
  const session = await spawnAs('next-backend-1031-0900');
  try {
    w.merge(['- [ ] **Backend:** catalog seed', '- [ ] **App:** sign-in screens'], 'feat: one');
    const out = w.run().out;
    assert.match(out, /Waiting on the backend lane: a session in this lane is still running\./);
    assert.equal(startsIn(out, 'backend'), 0);
    assert.equal(startsIn(out, 'app'), 1);
  } finally {
    session.kill();
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test('a session started before lanes existed blocks both lanes', async () => {
  const w = world();
  w.run();
  const session = await spawnAs('next-1030-0900');
  try {
    w.merge(['- [ ] **Backend:** catalog seed', '- [ ] **App:** sign-in screens'], 'feat: two');
    const out = w.run().out;
    assert.match(out, /Waiting on the app lane: a session in this lane is still running\./);
    assert.match(out, /Waiting on the backend lane: a session in this lane is still running\./);
    assert.equal(starts(out), 0);
  } finally {
    session.kill();
    rmSync(w.dir, { recursive: true, force: true });
  }
});

test('stops when every app and backend item is ticked, even with owner items left', () => {
  const w = world();
  w.run();
  w.merge(
    [
      '- [x] **Backend:** catalog seed',
      '- [x] **App:** sign-in screens',
      '- [ ] **Owner:** upload',
    ],
    'feat: the last item',
  );
  const done = w.run();
  assert.equal(done.status, 0);
  assert.match(
    done.out,
    /Every app and backend item in §14 is ticked; 1 owner item\(s\) remain\. Autopilot is done\./,
  );
  assert.equal(starts(done.out), 0);
  rmSync(w.dir, { recursive: true, force: true });
});

test('the status names unchecked items with no lane label', () => {
  const w = world();
  w.merge(['- [ ] **Backend:** catalog seed', '- [ ] an old unlabeled item'], 'docs: old');
  const out = w.run().out;
  assert.match(out, /Unchecked §14 items: app 0, backend 1, owner 0\./);
  assert.match(out, /1 unchecked §14 item\(s\) have no App, Backend or Owner label/);
  rmSync(w.dir, { recursive: true, force: true });
});

test('a restart says what it is watching', () => {
  const w = world();
  w.run();
  const again = w.run();
  assert.match(again.out, /Watching main at [0-9a-f]+ chore: start\./);
  assert.equal(starts(again.out), 0);
  rmSync(w.dir, { recursive: true, force: true });
});

test('Enter starts every lane, but not the same lane again within 2 minutes', () => {
  const w = world();
  const out = w.run('\n\nq').out;
  assert.match(out, /Waiting for your next merge/);
  assert.equal(startsIn(out, 'app'), 1);
  assert.equal(startsIn(out, 'backend'), 1);
  assert.match(
    out,
    /Not starting the app lane: a task in this lane started less than 2 minutes ago\./,
  );
  assert.match(out, /Press f, then a or b, to start the app or backend lane anyway\./);
  assert.match(out, /Autopilot stopped\./);
  rmSync(w.dir, { recursive: true, force: true });
});

test('Enter waits on a lane with an open PR, and f then b starts the backend lane anyway', () => {
  const w = world();
  writeFileSync(join(w.stub, 'prs'), '7\tbackend\tfeat(rules): add progression\n');
  const out = w.run('\nfbq').out;
  assert.match(out, /Not starting the backend lane: 1 pull request\(s\) open for this lane\./);
  assert.equal(startsIn(out, 'app'), 1);
  assert.equal(startsIn(out, 'backend'), 1);
  rmSync(w.dir, { recursive: true, force: true });
});

test('f then a starts the app lane anyway, and f then another key cancels', () => {
  const w = world();
  writeFileSync(join(w.stub, 'prs'), '9\tany\tdocs: no lane\n');
  const out = w.run('fxfaq').out;
  assert.match(out, /Start which lane anyway\? a: app, b: backend/);
  assert.match(out, /Cancelled\./);
  assert.equal(startsIn(out, 'app'), 1);
  assert.equal(starts(out), 1);
  rmSync(w.dir, { recursive: true, force: true });
});

test('a typed command with an f in it starts nothing', () => {
  const w = world();
  const out = w.run('git diff --stat main..HEADq').out;
  assert.match(out, /Start which lane anyway/);
  assert.match(out, /Cancelled\./);
  assert.equal(starts(out), 0);
  rmSync(w.dir, { recursive: true, force: true });
});

test('AUTOPILOT_LANES runs one lane only, and rejects an unknown lane', () => {
  const w = world();
  const out = w.run('\nfaq', { AUTOPILOT_LANES: 'backend' }).out;
  assert.equal(startsIn(out, 'backend'), 1);
  assert.equal(startsIn(out, 'app'), 0);
  assert.match(out, /Not starting the app lane: this autopilot runs only backend/);
  const bad = w.run(undefined, { AUTOPILOT_LANES: 'ios' });
  assert.equal(bad.status, 1);
  assert.match(bad.out, /AUTOPILOT_LANES takes app, backend or both, not 'ios'\./);
  rmSync(w.dir, { recursive: true, force: true });
});

test('other keys are ignored', () => {
  const w = world();
  const out = w.run('npm run autopilotq').out;
  assert.equal(starts(out), 0);
  assert.match(out, /Autopilot stopped\./);
  rmSync(w.dir, { recursive: true, force: true });
});

test("the PR filter reads each PR's Lane: line, and a PR without one counts for both", () => {
  const filter = readFileSync(SCRIPT, 'utf8').match(/^PR_JQ='(.*)'$/m)?.[1];
  assert.ok(filter, 'PR_JQ is defined on one line');
  const prs = [
    {
      number: 17,
      title: 'feat(rules): x',
      body: '## Why\r\nstuff\r\nLane: backend\r\nReview: careful',
    },
    { number: 18, title: 'docs: y', body: 'Mentions Lane: app mid-line only' },
    { number: 19, title: 'feat(app): z', body: 'Lane: app' },
    { number: 20, title: 'chore: no body', body: null },
    { number: 21, title: 'chore: wrong lane', body: 'Lane: application' },
  ];
  const out = execFileSync('jq', ['-r', filter], { input: JSON.stringify(prs), encoding: 'utf8' });
  assert.deepEqual(out.trim().split('\n'), [
    '17\tbackend\tfeat(rules): x',
    '18\tany\tdocs: y',
    '19\tapp\tfeat(app): z',
    '20\tany\tchore: no body',
    '21\tany\tchore: wrong lane',
  ]);
});

test('refuses to run outside the repo', () => {
  const outside = mkdtempSync(join(tmpdir(), 'saebom-outside-'));
  const result = spawnSync('bash', [SCRIPT], { cwd: outside, encoding: 'utf8', input: '' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Run this inside the saebom repo/);
  rmSync(outside, { recursive: true, force: true });
});
