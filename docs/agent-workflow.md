# Running Saebom's AI agents

This guide is for the owner. It explains how AI agents build Saebom from §14 of `docs/HANDOFF.md` while you review and merge. The rules agents follow live in `CLAUDE.md`, and the decisions behind this workflow are D58–D75 in the handoff. Until Nov 4, cloud sessions change parts of it; see [Cloud sessions until Nov 4](#cloud-sessions-until-nov-4-d73d74).

## How it fits together

- **Agents write the code; you review, test and merge (D58).** Each task runs in Claude Code on your Mac, in its own git worktree, and ends in one pull request (D60).
- **Two lanes, one pull request per lane per day (D68–D71).** The app lane builds `app/`, and the backend lane builds everything else. A session takes its lane's earliest §14 day and finishes all of that day's items in its lane in one pull request, one commit per item. Items labeled **Owner:** are yours.
- **pstack shapes how an agent works (D59).** Starting a task with `/pstack:poteto-mode` makes the agent restate the goal, pick a playbook, test first, prove the change works and write a clear PR. pstack is poteto's skill pack, and Claude Code installs it from `.claude/settings.json` when you trust the folder.
- **A second model reviews every PR (D63).** Gemini reviews Claude's PRs through Antigravity CLI, and Claude reviews Gemini's. The agent checks each finding and posts the result on the PR before you look.
- **Questions come to you as issues (D61).** When the spec doesn't say what the app should do, the agent opens a GitHub issue labeled `question` and keeps working on what it can. Your answer becomes a numbered decision in the next PR.
- **Guardrails hold whatever the agent decides (D65).** A guard hook and deny rules block production commands, pushes to `main`, merges, secret files and the rest of `CLAUDE.md`'s "Never" list.
- **No extra spend (D64).** Everything runs on your Claude Pro and Google AI Pro subscriptions, plus, until Nov 4, the free promotional cloud credit (D73).
- **Cloud sessions until Nov 4 (D73–D74).** You can also start Claude Code cloud sessions, as many at once as you like, each on an item or a group of items, with an Opus 5.5 cloud session as the second reviewer.
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
2. **Start a session per lane, each in a new worktree:** `claude -w <topic>`, such as `claude -w app-day3` and `claude -w backend-day3`. The autopilot does this and the next step for you.
3. **Give the task**, with `app` or `backend`:

   ```
   /pstack:poteto-mode You work the backend lane (D69). Take the earliest day in §14 of docs/HANDOFF.md
   that has unchecked **Backend:** items, and do all of that day's Backend items in one PR, one commit
   per item. Then run the second-review skill. Stop when the PR is ready for my review.
   ```

4. **The agent works.** It restates the goal, works test-first, runs `npm run verify`, renames the branch (`git branch -m feat/<topic>`), opens the PR, runs the Gemini second review, fixes the findings it confirms and posts the review as a comment. Questions it can't settle go to issues as it goes.
5. **You review, as closely as the PR asks** (see [How closely to review](#how-closely-to-review)). Read the PR's description and the second-review comment, then the diff. Ask for changes in the same session, or merge on GitHub.
6. **Do the production steps yourself:** `db push`, `functions deploy`, secrets, invites and builds (`CLAUDE.md`, "Owner only"), plus the **Owner:** items in §14.
7. **Close the session and remove the worktree once its PR is merged.** Claude Code asks whether to keep the worktree when you exit; you can also run `git worktree remove .claude/worktrees/<topic>`.

The two lanes are the two sessions Claude Pro allows at once (D60), so don't start a third alongside them. The lanes rarely touch the same files. When one lane needs the other's unmerged work, its session builds against the handoff's contract and says so in the PR, so merge the side it depends on first.

## Cloud sessions until Nov 4 (D73–D74)

Until the promotional cloud credit runs out or expires (Nov 4), you can run agent tasks as Claude Code cloud sessions alongside, or instead of, the two lanes on the Mac.

- **As many at once as you start.** Give each session one §14 item, or a few items you group, and tell it which lane (`Lane: app` or `Lane: backend`) and review depth the PR carries, and which `<type>/<topic>` branch to push to; otherwise the cloud hands it a `claude/…` branch (D75). It works under the same `CLAUDE.md`, opens one PR and stops.
- **Cloud PRs don't tick §14.** Each names the items it finishes in its body. Once a day, tick the merged items yourself in one docs PR, or have a session do it.
- **One PR at a time on the shared spots.** Only one open PR may change the route gate (`app/app/_layout.tsx` or `auth-state.ts`), and only one may add a migration or change `supabase/tests/schema_test.sql` (the DB lane). Don't start a second session on either until the first one's PR is merged or closed.
- **The cloud starts without Docker, and `gh` can't write there (D75).** Sessions start the Docker engine themselves before database work and use the GitHub connector for PRs, comments and issues; `CLAUDE.md` has the commands. On Nov 1, `npm run verify` passed end to end this way.
- **Node 22 in the cloud.** The cloud image puts Node 22 first on the PATH, with Node 24 at `/usr/local/bin`. Every check passes on 22. To match CI and the Mac, add `echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc` to the environment's setup script (the cloud environment menu in the session's title bar, then Edit). This hasn't been tested yet.
- **Checks the cloud can't run come back to the Mac.** Each cloud PR lists them under Verification. Run the Simulator, the iPhone and any other listed check on the Mac before merging.
- **The second review is a cloud session too (D74).** Start a cloud session on Opus 5.5 at max effort for each PR, for example:

  ```
  Second-review PR #<n> in rryan1010/saebom (D74). Read CLAUDE.md, then review the diff against it and
  the handoff. Check each finding against the code, keep only the ones you verified, and post them as
  one PR comment that starts with "**Second review** · Claude Opus 5.5 (max effort, cloud) · head <sha7>".
  Post it with the GitHub connector, since gh can't write from the cloud (D75). Don't push commits,
  approve or merge.
  ```

  The coding session, or a follow-up session, fixes what the review confirms. When Claude's limits run out, fall back to the Gemini review (`node scripts/agents/gemini-review.ts <pr>` on the Mac).

- **Spend stays at zero.** The credit is a free promotion, so it's allowed (D64 stands). Don't use Fable or buy usage credits; ultrareview's three free runs are fine, paid runs aren't.

After Nov 4, the Mac lanes, ticking in each PR and the Gemini review apply again as written (D60, D63, D64, D68).

## How closely to review

Each PR ends with a `Review:` line and an `iPhone:` line (D70).

- **`Review: careful (<why>)`:** migrations and pgTAP tests, `_shared/rules`, `_shared/coach`, Edge Functions, auth, the Keychain, the app lock, consent, injured areas and light training, and anything on `CLAUDE.md`'s "Never" list. Read these line by line; they're where a mistake reaches a tester.
- **`Review: light`:** everything else, such as docs, CI, config, theme and animations. Skim the description, the second review and the diff, then merge once CI is green.
- **`iPhone: now`:** behavior only a device shows (the Keychain, Face ID, notifications, the timer in the background). Install the branch (`npm --prefix app run ios:device`) before merging.
- **`iPhone: next milestone`:** merge after review, and test it with the rest at the next milestone.

Test on the iPhone from `main` at these milestones: after day 3 (invite sign-in with MFA), the day 5 milestone (a calibration pass logged, with next targets), after day 6 (reminders and the app lock) and on day 10 (the TestFlight build). Fix what you find in the next PR of the lane that owns it.

## Autopilot: each lane's next task starts when you merge (D67, D69)

The autopilot runs steps 1–3 of the loop for you, for both lanes. You keep reviewing and merging, and each lane's next task starts about a minute after a merge.

1. **Start it** in its own Terminal window, from your main checkout:

   ```bash
   cd ~/Development/saebom && git switch main
   npm run autopilot
   ```

2. **Leave that window open.** Every minute it checks GitHub. When `main` gets a new commit (your merge), it updates your main checkout and, for each lane that still has unchecked items, no open pull request and no running session, opens a new Terminal window running `claude -w next-<lane>-<date-time>` with that lane's prompt. A PR's lane comes from its `Lane:` line; a PR without one, such as a docs change you asked for, holds both lanes until you merge or close it. Each session works like one you started by hand: you can watch it and answer its prompts, and the guard and second review still apply.
3. **Follow along in its log.** It prints a timestamped line, and shows a Mac notification, when:
   - a pull request opens, with its lane;
   - a second review is posted, which means the PR is ready for your review;
   - a question issue needs your answer;
   - `main` moves after a merge;
   - it starts a lane's task, or why a lane is waiting instead (its PR still open, its session still running, or nothing left in it).
4. **Use the keys** in its window: **Enter** starts every lane that can start; **f** then **a** or **b** starts the app or backend lane anyway, even with its PR open or its session running; **s** shows the status, including how many app, backend and owner items are left; **q** quits. It never starts the same lane twice within 2 minutes, and anything typed while it's busy checking GitHub is discarded, so don't type commands into its window. It stops when every **App:** and **Backend:** item is ticked, and the **Owner:** items left are yours.
5. **When you restart it,** it prints `Watching main at …` and `Waiting for your next merge`, then stays quiet until something happens. A merge made while it was stopped starts tasks on the next check; otherwise press Enter.

What to know:

- **It never merges, pushes or touches production.** It only opens the sessions you'd open by hand, and your production steps after a merge stay yours.
- **If the Mac sleeps, it pauses** and catches up when the Mac wakes. A merge made while it was stopped starts tasks the next time you run it.
- **Two lanes use your Claude Pro limits about twice as fast.** When a session hits the limit, finish that task in Antigravity as usual (see below); its lane waits until that PR is merged, and the other lane keeps going. If both lanes keep hitting the limit, run one lane at a time: `AUTOPILOT_LANES=backend npm run autopilot` (or `app`).
- **The first notification** may ask you to allow notifications for Script Editor, which macOS uses to show them. Allow them in System Settings → Notifications if you want the banners.
- **To try it without opening sessions,** run `AUTOPILOT_DRY_RUN=1 npm run autopilot`: it prints the sessions it would open instead.

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
| Cloud coding session (D74)         | Opus 5.5                                      | high                               |
| Cloud second review (D74)          | Opus 5.5                                      | max                                |

Effort never goes below medium (D64), and the guard refuses subagents at `low`. Fable isn't used, because it bills to usage credits on Pro. Until Nov 4, the cloud second review replaces Gemini's, which stays the fallback (D74).

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
| `gh` fails with "HTTP 403: GitHub GraphQL is not available" in the cloud         | Cloud sessions block GitHub's GraphQL API, which most `gh pr` and `gh issue` commands use            | Use the GitHub connector for PRs, comments and issues, and `gh api -X GET` calls to list them (D75)                                              |
| `npx supabase start` in the cloud can't find `/var/run/docker.sock`              | The cloud doesn't start the Docker engine                                                            | Start `dockerd` as a background command and wait for `docker info`; start it again after the 2-hour limit (D75)                                  |
| `supabase start` says the db container is unhealthy after Docker restarts        | The engine brought the old containers back half-started                                              | Run `npx supabase stop`, then `npx supabase start` (D75)                                                                                         |
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
