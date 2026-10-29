// Tests for the Saebom guard (D65). Run: node --test "scripts/agents/*.test.*"
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { decide, isSecretPath, parseShell, render } from './guard.mjs';

const GUARD = fileURLToPath(new URL('./guard.mjs', import.meta.url));
const REPO = '/Users/owner/Development/saebom';

/** A throwaway git repository whose current branch is `branch`. */
function repoOn(branch) {
  const dir = mkdtempSync(join(tmpdir(), 'saebom-guard-'));
  execFileSync('git', ['init', '-q', '-b', branch, dir]);
  return dir;
}
const onFeature = repoOn('feat/plan-engine');
const onMain = repoOn('main');

const bash = (command, cwd = onFeature) =>
  decide({ tool_name: 'Bash', tool_input: { command }, cwd }).reason;

test('allows everyday commands', () => {
  for (const command of [
    'npm test',
    'npm run verify',
    'npm --prefix app run ios',
    'npx supabase start',
    'npx supabase status',
    'npx supabase db reset',
    'npx supabase functions serve --env-file supabase/functions/.env.local',
    'npx supabase migration new add_set_logs',
    'npx supabase test db',
    'npx supabase db lint --fail-on error',
    'npx supabase gen types --lang=typescript --local > supabase/functions/_shared/database.types.ts',
    'npx supabase --version',
    'git status',
    'git diff main...HEAD',
    'git commit -m "docs: explain why supabase db push and gh pr merge are owner-only"',
    'git commit -am "fix: mention --linked and scripts/.env.local in the docs"',
    'git push -u origin HEAD',
    'git push -u origin feat/plan-engine',
    'git push origin feat/maintenance-copy',
    'git push origin --delete feat/old-idea',
    'gh pr create --base main --title "feat(plan): add rules" --body "Never run gh pr merge"',
    'gh pr view 12 --json state',
    'gh pr comment 12 --body-file .agents/reviews/pr-12.md',
    'gh issue create --label question --title "Q: rest timer?" --body-file /tmp/q.md',
    'gh api repos/rryan1010/saebom/pulls/3/comments',
    'gh api -X GET search/issues -f q=repo:rryan1010/saebom',
    'ls -la app/.env.local',
    'test -f supabase/functions/.env.local && echo present',
    'git check-ignore -v app/.env.local',
    'cat app/.env.example',
    'cp app/.env.example /tmp/example',
    'cat scripts/agents/guard.mjs',
    'node --test "scripts/agents/*.test.*"',
    'echo "npx supabase db push is owner-only"',
    'rg "process.env.EXPO_PUBLIC" app/src',
    'claude -w day1-migrations',
    'node scripts/agents/gemini-review.ts 12',
    'npm run db:types 2>/dev/null || true',
  ]) {
    assert.equal(bash(command), null, command);
  }
});

test('blocks production and account commands', () => {
  for (const command of [
    'npx supabase db push',
    'supabase db push --dry-run',
    './node_modules/.bin/supabase db push',
    'npm exec -- supabase db push',
    'FOO=1 npx -y supabase db push',
    'npx supabase link --project-ref abcd',
    'npx supabase login',
    'npx supabase functions deploy',
    'npx supabase secrets set FOO=bar',
    'npx supabase db reset --linked',
    'npx supabase gen types --lang=typescript --linked',
    'npx supabase migration up',
    'npx supabase db dump -f dump.sql',
    'npx supabase config push',
    'npm run invite -- friend@example.com',
    'npm --prefix app run build:ios',
    'npm --prefix=app run submit:ios',
    'eas build --platform ios',
    'npx eas-cli submit',
    'xcrun altool --upload-app -f app.ipa',
    'security find-generic-password -s supabase',
    'printenv',
    'env',
  ]) {
    assert.match(
      bash(command) ?? '',
      /owner|hosted|account|credential|keychain|environment|Apple|Expo/,
      command,
    );
  }
});

test('blocks pushes to main, force-pushes, merges and approvals', () => {
  for (const command of [
    'git push origin main',
    'git push -u origin HEAD:main',
    'git push origin feat/x:refs/heads/main',
    'git push origin :main',
    'git push main',
    'git push --force origin feat/x',
    'git push -f',
    'git push -uf origin feat/x',
    'git push --force-with-lease',
    'git push --mirror',
    'git push origin +feat/x',
    `git -C ${onFeature} push origin main`,
    'gh pr merge 3 --squash',
    'gh -R rryan1010/saebom pr merge 3',
    'gh pr review 3 --approve',
    'gh api -X PUT repos/rryan1010/saebom/pulls/3/merge',
    'gh api repos/rryan1010/saebom/issues/3/comments -f body=hi',
    'gh repo edit --visibility public',
    'gh secret set SUPABASE_ACCESS_TOKEN',
    'gh workflow run backup.yml',
    'gh auth token',
  ]) {
    assert.notEqual(bash(command), null, command);
  }
  assert.match(bash('git push', onMain) ?? '', /main/);
  assert.match(bash('git push -u origin HEAD', onMain) ?? '', /main/);
  assert.equal(bash('git push', onFeature), null);
});

test('blocks hook bypasses and unguarded agents', () => {
  for (const command of [
    'git commit --no-verify -m wip',
    'git commit -nm wip',
    'git -c core.hooksPath=/dev/null commit -m x',
    'git config core.hooksPath .nohooks',
    'claude --dangerously-skip-permissions -p "do it"',
    'claude --permission-mode bypassPermissions',
    'agy -p "continue" --dangerously-skip-permissions',
  ]) {
    assert.notEqual(bash(command), null, command);
  }
});

test('blocks secret files in commands', () => {
  for (const command of [
    'cat supabase/functions/.env.local',
    'cat app/.env.local',
    'source app/.env.local',
    'grep KEY app/.env*',
    'node --env-file=scripts/.env.local scripts/invite.ts',
    'echo SECRET=1 > scripts/.env.local',
    'cp app/.env.example app/.env.local',
    'git add -f app/.env.local',
    'cat ~/.supabase/access-token',
    'cat AuthKey_ABC123.p8',
  ]) {
    assert.match(bash(command) ?? '', /secret|ignored/, command);
  }
});

test('blocks edits to the guardrails', () => {
  for (const command of [
    "sed -i '' 's/deny/allow/' scripts/agents/guard.mjs",
    'rm .claude/settings.json',
    "echo '{}' > .claude/settings.local.json",
    'cp /tmp/hooks.json .agents/hooks.json',
    'rm -rf scripts/agents/*',
    'git checkout main -- .agents/hooks.json',
  ]) {
    assert.match(bash(command) ?? '', /guardrail/, command);
  }
});

test('looks inside nested shells, substitutions and stdin scripts', () => {
  for (const command of [
    'bash -c "npx supabase db push"',
    "sh -lc 'git push origin main'",
    'echo $(npx supabase db push)',
    'echo `git push origin main`',
    'echo "npx supabase db push" | sh',
    "bash <<'EOF'\nnpx supabase db push\nEOF",
    'eval "gh pr merge 3"',
    'echo 3 | xargs gh pr merge',
    'npx -c "supabase db push"',
    'find . -name x -exec git push origin main \\;',
    'cd app && npx supabase db push',
    'npm test; git push origin main',
  ]) {
    assert.notEqual(bash(command), null, command);
  }
});

test('Claude file tools: secrets and guardrails', () => {
  const tool = (tool_name, tool_input) => decide({ tool_name, tool_input, cwd: REPO }).reason;
  assert.match(tool('Read', { file_path: `${REPO}/app/.env.local` }) ?? '', /secret/);
  assert.match(
    tool('Read', { file_path: `${REPO}/supabase/functions/.env.local` }) ?? '',
    /secret/,
  );
  assert.match(
    tool('Read', { file_path: '/Users/owner/Downloads/AuthKey_ABC123.p8' }) ?? '',
    /secret/,
  );
  assert.equal(tool('Read', { file_path: `${REPO}/app/.env.example` }), null);
  assert.equal(tool('Read', { file_path: `${REPO}/docs/HANDOFF.md` }), null);
  assert.equal(tool('Read', { file_path: `${REPO}/scripts/agents/guard.mjs` }), null);
  assert.match(
    tool('Write', { file_path: `${REPO}/scripts/agents/guard.mjs`, content: '' }) ?? '',
    /guardrail/,
  );
  assert.match(tool('Edit', { file_path: `${REPO}/.claude/settings.json` }) ?? '', /guardrail/);
  assert.match(
    tool('Write', { file_path: '/Users/owner/.claude/settings.json' }) ?? '',
    /guardrail/,
  );
  assert.equal(tool('Edit', { file_path: `${REPO}/CLAUDE.md` }), null);
  assert.equal(tool('Write', { file_path: `${REPO}/app/.env.example` }), null);
});

test('Claude subagents: effort floor and no Fable', () => {
  const agent = (tool_input) => decide({ tool_name: 'Agent', tool_input }).reason;
  assert.match(agent({ prompt: 'x', effort: 'low' }) ?? '', /medium/);
  assert.match(agent({ prompt: 'x', model: 'fable' }) ?? '', /Fable/);
  assert.equal(agent({ prompt: 'x', effort: 'medium', model: 'sonnet' }), null);
  assert.equal(agent({ prompt: 'x' }), null);
  assert.match(decide({ tool_name: 'Task', tool_input: { effort: 'low' } }).reason ?? '', /medium/);
});

test('MCP tools: merges and secret paths', () => {
  assert.match(
    decide({ tool_name: 'mcp__github__merge_pull_request', tool_input: {} }).reason ?? '',
    /merges/,
  );
  assert.equal(
    decide({ tool_name: 'mcp__github__get_pull_request', tool_input: { pullNumber: 3 } }).reason,
    null,
  );
});

test('Antigravity payloads', () => {
  const agy = (name, args) =>
    decide({
      toolCall: { name, args },
      workspacePaths: [onFeature],
      conversationId: 'c',
      modelName: 'm',
    });
  const pushMain = agy('run_command', { CommandLine: 'npx supabase db push' });
  assert.equal(pushMain.format, 'antigravity');
  assert.match(pushMain.reason ?? '', /owner/);
  assert.equal(agy('run_command', { CommandLine: 'npm test' }).reason, null);
  assert.equal(agy('run_command', { CommandLine: 'git push -u origin HEAD' }).reason, null);
  assert.match(agy('view_file', { AbsolutePath: `${REPO}/app/.env.local` }).reason ?? '', /secret/);
  assert.match(
    agy('write_to_file', { TargetFile: `${REPO}/.agents/hooks.json` }).reason ?? '',
    /guardrail/,
  );
  assert.match(
    agy('replace_file_content', { TargetFile: `${REPO}/scripts/agents/guard-agy.sh` }).reason ?? '',
    /guardrail/,
  );
  assert.match(
    agy('grep_search', { SearchPath: `${REPO}/scripts/.env.local` }).reason ?? '',
    /secret/,
  );
  assert.equal(agy('view_file', { AbsolutePath: `${REPO}/CLAUDE.md` }).reason, null);
});

test('render speaks each tool’s format', () => {
  assert.equal(render('claude', null), '');
  const claudeDeny = JSON.parse(render('claude', 'no'));
  assert.equal(claudeDeny.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(claudeDeny.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.deepEqual(JSON.parse(render('antigravity', null)), { decision: 'allow' });
  assert.equal(JSON.parse(render('antigravity', 'no')).decision, 'deny');
  const unknown = JSON.parse(render('unknown', 'no'));
  assert.equal(unknown.decision, 'deny');
  assert.equal(unknown.hookSpecificOutput.permissionDecision, 'deny');
});

test('the hook process fails closed and always exits 0', () => {
  const run = (input) => spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8' });
  const denied = run(
    JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'gh pr merge 3' }, cwd: onFeature }),
  );
  assert.equal(denied.status, 0);
  assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const allowed = run(
    JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: onFeature }),
  );
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, '');
  const garbage = run('{"toolCall": nope');
  assert.equal(garbage.status, 0);
  assert.equal(JSON.parse(garbage.stdout).decision, 'deny');
  const empty = run('');
  assert.equal(JSON.parse(empty.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('parseShell keeps quoted text whole and finds substitutions', () => {
  const parsed = parseShell(`git commit -m "a; b && c" && echo "$(whoami)" 'x|y'`);
  assert.deepEqual(parsed.commands[0], ['git', 'commit', '-m', 'a; b && c']);
  assert.deepEqual(parsed.nested, ['whoami']);
  assert.equal(parsed.opaque, false);
  assert.equal(parseShell('cat <<EOF\nhi\nEOF').opaque, true);
});

test('isSecretPath', () => {
  for (const p of [
    '.env',
    'app/.env.local',
    '/x/.env.production.local',
    'a/.env*',
    'k.p8',
    '/Users/o/.ssh/id_ed25519',
  ]) {
    assert.equal(isSecretPath(p), true, p);
  }
  for (const p of [
    'app/.env.example',
    '.envrc.md',
    'process.env.X',
    'docs/env.md',
    'src/.environment.ts',
  ]) {
    assert.equal(isSecretPath(p), false, p);
  }
});
