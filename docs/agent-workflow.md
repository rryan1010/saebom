# Running Saebom's AI agents

This guide is for the owner. It explains how AI agents build Saebom from §14 of `docs/HANDOFF.md` while you review and merge. The rules agents follow live in `CLAUDE.md`, and the decisions behind this workflow are D58–D65 in the handoff.

## How it fits together

- **Agents write the code; you review, test and merge (D58).** Each task runs in Claude Code on your Mac, in its own git worktree, and ends in one pull request (D60, D62).
- **pstack shapes how an agent works (D59).** Starting a task with `/pstack:poteto-mode` makes the agent restate the goal, pick a playbook, test first, prove the change works and write a clear PR. pstack is poteto's skill pack, and Claude Code installs it from `.claude/settings.json` when you trust the folder.
- **A second model reviews every PR (D63).** Gemini reviews Claude's PRs through Antigravity CLI, and Claude reviews Gemini's. The agent checks each finding and posts the result on the PR before you look.
- **Questions come to you as issues (D61).** When the spec doesn't say what the app should do, the agent opens a GitHub issue labeled `question` and keeps working on what it can. Your answer becomes a numbered decision in the next PR.
- **Guardrails hold whatever the agent decides (D65).** A guard hook and deny rules block production commands, pushes to `main`, merges, secret files and the rest of `CLAUDE.md`'s "Never" list.
- **No extra spend (D64).** Everything runs on your Claude Pro and Google AI Pro subscriptions.
- **Noodle waits until after Nov 6 (D59).** See [Noodle, after Nov 6](#noodle-after-nov-6).

## One-time setup on the Mac

Do this once, in order. It takes about 45 minutes.

1. **Merge the agent-workflow pull request**, then link your folder as day 1 says (§14). The `git pull origin main` step brings in `CLAUDE.md`, this guide and the agent config.
2. **Make the repo public and add the ruleset on `main`** (§14, day 1): require a pull request, block force-pushes, and add the CI check once `ci.yml` exists. On GitHub Free, rulesets need a public repo (D57). The ruleset backs up the guard on GitHub's side, so even a command the guard misses can't push to `main`. Push your first commit to `main` before you add it.
3. **Create the two local env files** in the main checkout, once the local stack exists (day 1):
   - `app/.env.local`, with the API URL and publishable key from `npx supabase status`;
   - `supabase/functions/.env.local`, with the local function secrets.

   `.worktreeinclude` copies both into every agent worktree. `scripts/.env.local` stays in your main checkout only, because it holds the production secret key (D60).

4. **Start Claude Code** in `~/Development/saebom` and accept the trust prompt. Claude Code then registers the `cursor-plugins` marketplace and loads pstack. Run `/plugin` to confirm pstack is listed; if it isn't, run `/reload-plugins` or start a new session. Then run `/context` and check that `.claude/rules/pstack-models.md` is loaded. Don't run `/pstack:setup-pstack`: that project rule replaces it.
5. **Smoke-test the guard in Claude Code.** Ask Claude to run each of these, and expect a refusal:
   - `git push origin main --dry-run`, which a deny rule blocks;
   - "Start a subagent at low effort that says hi", which only the guard hook blocks. If this one runs, the hook didn't start, most often because `node` isn't on Claude Code's PATH (see [Troubleshooting](#troubleshooting)).
6. **Install Antigravity CLI** from https://antigravity.google/docs/install. Run `agy` once inside `~/Development/saebom`, sign in with your Google AI Pro account, and trust the folder, because Antigravity loads `.agents/hooks.json` only in a trusted folder.
7. **Pick the Gemini model.** Run `agy models` and find Gemini 4 Argon's id. If it isn't `gemini-4-argon`, add `export GEMINI_REVIEW_MODEL=<id>` to `~/.zshrc`. A known bug (antigravity-cli issue #1228) can make Antigravity ignore `gemini-4-argon` and fall back to Gemini 3.8 Flash. The review script reports which model ran, so you'll see it if that happens.
8. **Smoke-test the guard in Antigravity.** In `agy`, ask it to run `git push origin main --dry-run`, and expect a "Saebom guard" refusal. If every tool call fails with "pre-tool hook failed", the hook can't start; see [Troubleshooting](#troubleshooting).
9. **Check the GitHub CLI** with `gh auth status`. Agents use it to open PRs and issues, and you can follow both in the GitHub app on your phone.

## The loop for each task

1. **Update `main`:** `cd ~/Development/saebom && git switch main && git pull`.
2. **Start a session in a new worktree:** `claude -w <topic>`, such as `claude -w day1-migrations`.
3. **Give the task:**

   ```
   /pstack:poteto-mode Take the next task from §14 of docs/HANDOFF.md: <the item, or "the first unchecked one">.
   One PR, then run the second-review skill. Stop when the PR is ready for my review.
   ```

4. **The agent works.** It restates the goal, works test-first, runs `npm run verify`, renames the branch (`git branch -m feat/<topic>`), opens the PR, runs the Gemini second review, fixes the findings it confirms and posts the review as a comment. Questions it can't settle go to issues as it goes.
5. **You review.** Read the PR's description and the second-review comment, then the diff. If the PR changes the app, check out the branch and try it on the iPhone (`npm --prefix app run ios:device`). Ask for changes in the same session, or merge (squash) on GitHub.
6. **Do the production steps yourself:** `db push`, `functions deploy`, secrets, invites and builds (`CLAUDE.md`, "Owner only").
7. **Close the session and remove the worktree once its PR is merged.** Claude Code asks whether to keep the worktree when you exit; you can also run `git worktree remove .claude/worktrees/<topic>`.

A second session can run at the same time when its task touches different files, such as tests or docs while the first builds a screen. On Claude Pro, two sessions at once is the ceiling (D60).

## Questions and decisions

- **A question arrives** as a GitHub issue labeled `question`, laid out as Question, Context, Options, Default meanwhile and Blocks. The agent has already marked the option it would pick.
- **Answer in a comment.** One line is enough.
- **The answer becomes a decision.** The next session runs the log-decision skill: a new D-number in §3, plus every spec section, `CLAUDE.md` line and test it affects, all in one PR. The PR says `Closes #<issue>`, so merging it closes the question.
- **After merging,** refresh the claude.ai project copies of `HANDOFF.md` and `CLAUDE.md`, so planning chats see the change (D40).
- **To change a requirement yourself,** tell an agent in a session or open an issue. Either way it becomes a D-number with its tests.

## When Claude's limits run out (D64)

Claude Pro's five-hour and weekly limits are shared with claude.ai, and agent sessions use them quickly.

1. **Lower the effort first.** Run `/effort medium` in the session; never go lower. Avoid pstack's `/arena` and `/swarm`, which run several agents at once.
2. **Then switch to Gemini.** In the same worktree, run `agy --model <Argon id> --effort high` and tell it:

   ```
   Claude ran out of usage partway through this task. Read GEMINI.md, then continue: <the task>.
   The branch is <branch>, and the PR (if any) is #<n>. Finish it the way CLAUDE.md says.
   ```

3. **A PR Gemini wrote** waits for Claude's second review once Claude's limits reset. Merge it only after that review.
4. **Never start `agy` with `--dangerously-skip-permissions`.** Antigravity skips hooks under that flag, so the guard would stop working.

## Models and effort

| Role                               | Model                                         | Effort                             |
| ---------------------------------- | --------------------------------------------- | ---------------------------------- |
| Main Claude session                | Opus 5.5 (Claude Code's default on Pro)       | high; medium when limits are tight |
| pstack code delegates              | Sonnet 5.5 (`.claude/rules/pstack-models.md`) | high                               |
| pstack judgment and reviews        | Opus 5.5                                      | high                               |
| Gemini, second review and fallback | Gemini 4 Argon                                | high                               |

Effort never goes below medium (D64), and the guard refuses subagents at `low`. Fable isn't used, because it bills to usage credits on Pro.

## What enforces each rule

| Rule (`CLAUDE.md`)                                                                                             | Enforced by                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| No pushes to `main`, no force-pushes                                                                           | Guard hook and deny rules; the ruleset on `main` on GitHub's side              |
| No merges or approvals by agents                                                                               | Guard hook and deny rules; you merge                                           |
| No production or account commands (`db push`, `functions deploy`, `link`, `secrets`, `--linked`, invites, EAS) | Guard hook and deny rules                                                      |
| No secret files (`.env.local`, `scripts/.env.local`, signing keys)                                             | Guard hook and `Read` deny rules; `.gitignore`; GitHub secret scanning (day 9) |
| No hook bypasses (`--no-verify`, `core.hooksPath`)                                                             | Guard hook and deny rules                                                      |
| No unguarded agents (bypass mode, `--dangerously-skip-permissions`)                                            | `disableBypassPermissionsMode`; the guard hook                                 |
| Agents don't edit the guardrails                                                                               | Guard hook and `Edit` deny rules; you review any change to them                |
| Effort at medium or above; no Fable                                                                            | Guard hook, for subagents                                                      |
| Tests, RLS, accessibility and no health data in logs                                                           | Tests, CI and your review, with the second review's help                       |

The guard reads command text, so it can't see inside script files or interpreters (`bash x.sh`, `node -e`), or files a program opens without naming them. The deny rules, the ruleset and your review cover those.

## Troubleshooting

| Symptom                                                                          | Cause                                                                                                | Fix                                                                                                                                              |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The low-effort subagent test runs instead of being refused                       | Claude Code couldn't start `node` for the hook                                                       | Run `which node` in the terminal you start `claude` from; if it's empty, run `nvm use` there or set an nvm default (`nvm alias default 24`)      |
| Every Antigravity tool call fails with "pre-tool hook failed"                    | The hook couldn't run `scripts/agents/guard-agy.sh`                                                  | Start `agy` from the repo root, and check that the script is executable (`chmod +x scripts/agents/guard-agy.sh`)                                 |
| Antigravity refuses everything with "Node.js was not found"                      | Antigravity's trimmed environment has no `node`, and the launcher didn't find one in nvm or Homebrew | Install Node 24 through nvm (`~/.nvm/versions/node/v24…`) or Homebrew                                                                            |
| The second-review comment says "Model used: Gemini 3.8 Flash"                    | Antigravity didn't recognize the model id (issue #1228)                                              | Run `agy models` and set `GEMINI_REVIEW_MODEL` to Argon's id                                                                                     |
| `gemini-review.ts` exits 3 with "signed out"                                     | Antigravity's cached sign-in expired                                                                 | Run `agy` once and sign in again                                                                                                                 |
| `gemini-review.ts` exits 2                                                       | The diff looks like it holds a secret; nothing was sent                                              | Take the secret out of the branch, and rotate it if it was ever pushed                                                                           |
| A worktree has no `.env.local` files                                             | They didn't exist in the main checkout when the worktree was created                                 | Create them in the main checkout (setup step 3), then start a new worktree                                                                       |
| `/plugin` shows pstack as "enabled in project settings but isn't installed here" | The marketplace hasn't registered yet                                                                | Accept the trust prompt, then run `/reload-plugins`; or run `/plugin marketplace add cursor/plugins` and `/plugin install pstack@cursor-plugins` |
| An agent says the guard blocked a step it needs                                  | The step is yours by design                                                                          | Run it yourself; if the guard is wrong, edit it by hand and open a PR with a test                                                                |

## Noodle, after Nov 6

Noodle is poteto's scheduling loop. A scheduler agent reads a backlog, writes work orders, and runs agents in parallel worktrees until the backlog is empty. It fits the long deferred list after the beta. It doesn't fit the build window, for three reasons:

- **It merges into your local `main`.** Finished work is rebased and merged into the branch that `origin/HEAD` names; there are no pull requests. Saebom's rule is that only your merge of a reviewed PR updates `main`.
- **It runs agents with permission checks off.** It starts Claude Code with `--permission-mode bypassPermissions`, and Codex with its approvals and sandbox off. This repo disables bypass mode (D65), and Claude Code's deny rules keep blocking in every mode.
- **Setup takes time the window doesn't have:** schedule and execute skills, a backlog adapter, and new guardrails.

To adopt it later, plan to:

1. Use a separate clone (such as `~/Development/saebom-noodle`) with `mode = "supervised"` and `max_concurrency = 1` on Claude Pro.
2. Keep merges off `main`. Point the clone's `origin/HEAD` at an integration branch (`git remote set-head origin agents/integration`), and add a skill that opens a pull request from that branch. Test this before trusting it.
3. Allow bypass mode only in that clone's local settings, keep the deny rules, and check that the guard hook still runs in bypass mode before relying on it.
4. Point `[skills] paths` at `.claude/skills`, and write a backlog adapter that reads §14's checklist or GitHub issues, leaving out `question` issues.

Sources: [Noodle docs](https://poteto.github.io/noodle/introduction.html) and [modes](https://poteto.github.io/noodle/concepts/modes.html); Noodle's source shows the merge into `origin/HEAD`'s branch and the bypass flag.
