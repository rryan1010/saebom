# Saebom (새봄)

This is the standing memory for AI agents in this repo. Claude Code loads it at the start of every session, and `AGENTS.md` links to it so Antigravity CLI and other agents load the same rules; `GEMINI.md` adds what differs for Gemini. The full spec lives in `docs/HANDOFF.md`, and on product behavior the handoff wins. Keep both current in the same pull request: a new decision goes in the handoff's §3, a changed command or convention goes here. How the owner runs agents day to day is in `docs/agent-workflow.md`.

Handoff map: §3 decisions · §6 data model and RLS · §7 plan engine · §8 session and look · §9 reminders · §10 AI coach · §11 accounts, consent, demo · §12 security, secrets, backups · §13 iOS build and TestFlight · §14 schedule and progress · §15 checks before inviting testers · §18 public launch.

## Working agreement

- **Agents write the code; the owner reviews, tests on the iPhone and merges (D58).** Agents never merge, approve their own work or touch production.
- **pstack is the agent framework (D59).** Start any task that touches more than one file, makes a design choice or chases a bug of unknown cause with `/pstack:poteto-mode`. Where pstack and this file disagree, this file wins.
- **Pick work from §14.** The next task is the first unchecked item in §14 that no open PR covers. Split a large item into PR-sized tasks, and tick the item in the PR that finishes it.
- **One task, one worktree, one PR (D60, D62).** Each session runs in its own git worktree (`claude -w <topic>`) on the owner's Mac, at most two sessions at a time.
- **Questions go to the owner as issues (D61).** A product or preference question that the handoff doesn't answer and no experiment can settle goes through the **ask-owner** skill. Keep working on whatever the question doesn't block.
- **Decisions are logged in the same PR (D40, D61).** Run the **log-decision** skill when the owner answers a question or changes a requirement.
- **Every PR gets a second review from the other model family (D63).** Run the **second-review** skill before handing a PR to the owner.
- **No extra spend (D64).** No usage credits, API keys or Fable. Effort can drop to medium when limits are tight, never lower. When Claude's limits run out, the owner continues the task in Antigravity CLI with Gemini (`GEMINI.md`).
- Build window: Mon Oct 26 – Fri Nov 6, 2026.

## Project goals

Saebom is an invite-only iPhone app for gym weightlifting, tested by friends and family through TestFlight. There is no public App Store listing yet.

1. **Plan:** fixed rules, never AI, build a safe starting plan. Workouts rotate A, B, C…, starting with a light calibration pass. Each injured area is trained around or, after the tester acknowledges a direct warning, trained light (D46–D47). Nothing requires a doctor's approval (D49), and comfort check-ins offer to lower weight or reps (D50).
2. **Session:** a timed workout records weight × reps for every set, works offline and uploads once on Finish.
3. **Reminders:** local notifications on chosen weekdays, skipped when today's workout is recorded.
4. **AI coach (opt-in):** once a week, up to 3 changes from a fixed menu, checked by code and approved by the user.

Done on Nov 6: the app on the owner's iPhone from TestFlight, the first build submitted for TestFlight App Review, and CI green. Safety beats features: §14 lists what to cut, and tests are never cut.

## Architecture

- **App (`app/`):** Expo (React Native, TypeScript, Expo Router), iOS only. The session token sits in the Keychain (expo-secure-store, this device only) and the in-progress workout in app storage. Reminders are local (expo-notifications). The app locks after 15 minutes idle or in the background, and Face ID or the passcode unlocks it (expo-local-authentication). Rings and motion use react-native-svg and Reanimated.
- **Backend (`supabase/`):** Supabase Free. Auth (password plus TOTP MFA, anonymous demo sessions, an invite-only Before User Created hook), Postgres with RLS on every table, Edge Functions (Deno) and Cron.
- **AI:** Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` in JSON Mode), called only by `coach-review`.
- **Ops:** GitHub Actions runs CI, deploys `main` and takes a nightly encrypted backup to a second Supabase project. Release builds are made on the owner's Mac and shipped through TestFlight.
- **Data flow:** the app reads its own rows and writes only `profiles` and `consents`; Edge Functions write everything else. Real accounts must have passed MFA (`aal2`); demo sessions are anonymous.

## Layout

```
saebom/
├─ CLAUDE.md  AGENTS.md (links here)  GEMINI.md  README.md  LICENSE  package.json  vitest.config.ts
├─ tsconfig.json  .nvmrc  .prettierrc  .gitignore  .worktreeinclude
├─ app/                        Expo app
│  ├─ app/                     routes: (auth)/ (onboarding)/ (tabs)/ session/
│  ├─ src/lib/                 Supabase client, Keychain storage, app lock, reminders, session store
│  ├─ src/ui/                  theme tokens, Ring, RoundButton, transitions
│  ├─ app.json  eas.json  metro.config.js  eslint.config.js
│  ├─ plugins/                 Expo config plugins (withNoScriptSandbox.js, D56)
│  ├─ ios/                     generated by prebuild; never edited, git-ignored
│  └─ .env.local               EXPO_PUBLIC_* values (git-ignored; .env.example is committed)
├─ supabase/
│  ├─ config.toml              local stack, auth settings, [functions.coach-review] verify_jwt = false
│  ├─ migrations/              timestamped SQL, never edited once pushed
│  ├─ seed.sql                 exercise catalog with form cues; demo templates
│  ├─ tests/                   pgTAP RLS tests
│  └─ functions/
│     ├─ _shared/rules/        plan engine and progression (pure TypeScript)
│     ├─ _shared/coach/        summary builder and checker (pure TypeScript)
│     ├─ generate-plan/  finish-workout/  accept-suggestion/  coach-review/
│     ├─ export-data/  delete-account/  seed-demo/
│     └─ .env.local            local function secrets (git-ignored)
├─ scripts/
│  ├─ invite.ts                owner-only; reads scripts/.env.local (git-ignored)
│  └─ agents/                  guard.mjs (the hook, D65), guard-agy.sh, gemini-review.ts, tests
├─ .claude/                    settings.json (deny rules, hooks, pstack), rules/pstack-models.md, skills/
├─ .agents/                    hooks.json (Antigravity's guard hook)
├─ docs/                       HANDOFF.md, agent-workflow.md, threat-model, hipaa-mapping, privacy-policy,
│                              emergency-access, incident-response
└─ .github/                    workflows/ (ci.yml, deploy.yml, backup.yml), dependabot.yml, ISSUE_TEMPLATE/
```

The app imports `_shared/` through Metro (`watchFolders` in `metro.config.js`), the Edge Functions import it directly, and Vitest tests it from the repo root.

## Rules

**IMPORTANT. Never:**

- push to `main`, force-push, merge a pull request or approve one. Work on a branch and open a PR; the owner merges once CI passes and the second review is posted.
- commit, print or paste a secret (secret keys, tokens, passwords, `.env*` values), and never open `scripts/.env.local` or `supabase/functions/.env.local`. Never send secrets, `.env*` contents or tester data to an AI service, an issue, a PR or a comment. The repo, its issues and its CI logs are public.
- touch production. `supabase link`, `login`, `db push`, `functions deploy`, `secrets set`, any `--linked` or `--db-url` flag, `npm run invite`, and EAS builds or submits belong to the owner (or to `deploy.yml` on `main`). Agents work against the local stack.
- edit a migration that has been pushed; write a new one.
- skip, delete or loosen a test, or bypass a hook (`.skip`, `--no-verify`), to get a check to pass.
- put health data (weights, reps, records, injured areas and how they're trained, readiness answers) in notifications, logs, audit events or AI prompts.
- answer a product question yourself; ask the owner (D61).
- edit the guardrails (`scripts/agents/guard*`, `.claude/settings*.json`, `.agents/hooks.json`) or start any agent with its permission checks off (`--dangerously-skip-permissions`, `bypassPermissions`). The owner maintains them; describe a change you need in the PR body.

**Enforcement (D65):** the guard hook `scripts/agents/guard.mjs` and the deny rules in `.claude/settings.json` block most of this list for Claude Code and Antigravity CLI. A block is the rule working: don't look for another way to run the command. If the work needs it, it's the owner's step.

**Database:** every new table ships in one PR with `enable row level security`, its policies, the restrictive "mfa or demo" policy, explicit grants and pgTAP tests. Internal functions set `search_path = ''`, use schema-qualified names, and revoke `execute` from `public`, `anon` and `authenticated`. Closed sets are `text` with a `check` constraint. `vault.create_secret` never goes in a migration.

**Plan engine (`_shared/`):** pure TypeScript with no Deno, Node, React Native or Supabase imports, no I/O, and no `Date.now()` or `Math.random()` (pass `now` in). Relative imports end in `.ts`. Tests guard these invariants: 6–8 reps is the baseline for every exercise, and new lifters get 8–10 (D48); reps never above 12, and never above 10 without an injured area; weights at or above the exercise's minimum load and a multiple of its increment; at most one increment up per session; lighter weeks at least 4 weeks apart; areas being trained around never loaded, great or light (D51); no deadlift for new lifters (D52); swaps never into a main lift; light exercises (D47) never main lifts or barbell lifts, always 2 sets of 10–12, and up in weight only when every set hit 12 reps and none felt hard.

**Edge Functions:** user-facing functions use the auth wrapper in §12 and reject callers that are neither `aal2` nor anonymous. They validate every payload and use the secret key only for writes RLS forbids. `coach-review` accepts only the named `cron` key.

**App:** only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ship in the bundle. Every ring and button gets an `accessibilityLabel`, text follows Dynamic Type, and transitions become fades under Reduce Motion. Rings never appear as three nested rings (Apple guideline 5.2.5). UI text is English; 새봄 appears only in the wordmark and icon. Weights are pounds only, named `_lb`. No analytics, ads, location or crash SDKs; add app packages with `npx expo install <package>` from inside `app/`. "Train it light" is never saved until the tester acknowledges its warning (`light_ack_at`); the warning text lives in handoff §11 and isn't shortened or softened. No doctor's note or clearance is asked for anywhere, and no screen blocks the plan for lack of one (D49). Comfort check-in answers stay on the phone; only the choice to go lighter is sent (D50).

**AI coach:** the model's output is untrusted input, and the checker is the security boundary. Prompts carry only the anonymous summary: no user text, IDs, names, emails, dates or injured areas. Light exercises (D47) stay out of the summary, and the checker rejects any change that names one.

## Coding standards

- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (no `enum`, `namespace` or parameter properties; use string-literal unions) and `allowImportingTsExtensions` with `noEmit: true`. No `any`.
- **JavaScript exceptions:** Expo config plugins in `app/plugins/` stay `.js`, because Expo loads them as JavaScript. The guard (`scripts/agents/guard.mjs`) is plain JavaScript checked with `// @ts-check`, so it runs on any Node version without a build step: a Claude Code hook that fails to start lets the call through. Everything else is TypeScript.
- **Lint and format:** in `app/`, the flat ESLint config from `npx expo lint` (`eslint-config-expo`) plus `eslint-plugin-prettier/recommended`. `deno lint` covers the Edge Functions. Prettier formats everything from the root `.prettierrc` (`"singleQuote": true, "printWidth": 100`).
- **Files:** Expo Router routes in lowercase (`app/app/(tabs)/progress.tsx`), components `PascalCase.tsx` (`src/ui/Ring.tsx`), hooks `useThing.ts`, other modules `kebab-case.ts`, tests `*.test.ts` beside the code, functions `kebab-case/index.ts`.
- **Names:** `camelCase` values and functions, `PascalCase` components and types, `UPPER_SNAKE_CASE` constants (`MAX_REPS = 12`), units in names (`weightLb`, `durationS`).
- **SQL:** lowercase keywords; plural `snake_case` tables; `snake_case` columns with unit suffixes (`weight_lb`, `duration_s`) and `_at` timestamps; schema-qualified names (`public.set_logs`); policies named in plain words ("read own").
- **Data identifiers:** exercise slugs in `snake_case` (`lat_pulldown`); audit actions in `snake_case` past tense (`session_recorded`).
- **Git (D62):** branches `<type>/<topic>`, with the Conventional Commits types `feat`, `fix`, `test`, `refactor`, `docs`, `chore` and `ci`. Claude Code names a worktree's branch `worktree-<name>`, so rename it before the first push (`git branch -m feat/plan-engine`). Conventional Commits for every commit and every PR title (`feat(plan): add lighter-week rule`). One PR per task.
- **PR body:** pstack's opening-a-pr format (Why, What changed, Scope, Blast Radius, Verification), plus these lines at the end: the §14 item it covers; `Decisions: D<n>` and `Closes #<issue>` when it logs an answer; `Open questions: #<issue>` when it runs on a default; `Agent: Claude Code · <model>` or `Agent: Antigravity CLI · <model>`; and the second-review comment link.

## Commands

The repo is `rryan1010/saebom`, cloned at `~/Development/saebom` on the owner's Mac (D55, D57); the bundle ID is `com.rrim.saebom`. Needs Node 24 (`.nvmrc`), Docker Desktop, Deno 2 and Xcode. The Supabase CLI is pinned in the root `package.json`, so call it as `npx supabase`. Run commands from the repo root. Start the local stack before anything that uses the database, and run long-lived commands (`functions serve`, `expo run:ios`, `expo start`) in the background. Day 1 creates the npm scripts below; if one is missing, add it with the command in its comment.

Set up:

```bash
nvm use && npm install                 # root tools: Vitest, fast-check, Prettier, Supabase CLI
npm --prefix app install               # the Expo app
npx supabase start                     # local stack in Docker
npx supabase status                    # API URL and publishable key for app/.env.local
```

Run:

```bash
npx supabase db reset                  # rebuild the local database from migrations and seed.sql
npx supabase functions serve --env-file supabase/functions/.env.local
npm --prefix app run ios               # expo run:ios: dev build in the iOS Simulator
npm --prefix app run ios:device        # expo run:ios --device: dev build on the iPhone
npm --prefix app start                 # expo start: Metro for an installed dev build
```

Fix the native project (see the handoff's §13 troubleshooting table):

```bash
(cd app && npx expo prebuild -p ios --clean)   # regenerate app/ios from app.json and plugins/
lsof -nP -iTCP:8081 -sTCP:LISTEN              # a stale Metro server; stop it with kill <PID>
open app/ios/Saebom.xcworkspace               # Xcode: always the workspace, never the .xcodeproj
```

Change the database:

```bash
npx supabase migration new <snake_case_name>   # new file in supabase/migrations/
npx supabase test new <name>                   # new pgTAP file in supabase/tests/
npm run db:types   # supabase gen types --lang=typescript --local > supabase/functions/_shared/database.types.ts && prettier --write supabase/functions/_shared/database.types.ts
```

Test and check (everything passes before every PR):

```bash
npm test                         # vitest run: plan engine and coach checker, unit and property tests
npm run test:db                  # supabase test db: pgTAP RLS tests
npm run lint:db                  # supabase db lint --fail-on error
npm run check:functions          # deno check supabase/functions/*/index.ts && deno lint supabase/functions
npm --prefix app run typecheck   # tsc --noEmit
npm --prefix app run lint        # expo lint
npm run format:check             # prettier --check .
npm run test:agents              # node --test "scripts/agents/*.test.*": the guard and the review script
npm run verify                   # all of the above in this order; ci.yml runs the same
```

Work in a worktree, open a PR and get the second review:

```bash
claude -w <topic>                              # new session in .claude/worktrees/<topic>; .worktreeinclude copies the .env.local files
git branch -m <type>/<topic>                   # before the first push
git push -u origin HEAD
gh pr create --base main --title "<type>(<scope>): <subject>" --body-file <file>
node scripts/agents/gemini-review.ts <pr>      # second review by Gemini (second-review skill)
gh issue create --label question --title "Q: <question>" --body-file <file>   # ask-owner skill
```

Owner only, never an agent:

```bash
npm run invite -- friend@example.com           # node --env-file=scripts/.env.local scripts/invite.ts
npm run invite -- --reset friend@example.com   # one-time code for a password reset
npx supabase db push --dry-run                 # then: npx supabase db push
npx supabase functions deploy                  # all functions; coach-review's verify_jwt = false comes from config.toml
npm install -g eas-cli                         # once, for the two release commands below
npm --prefix app run build:ios                 # eas build --platform ios --profile production --local --output ./build/saebom.ipa
npm --prefix app run submit:ios                # eas submit --platform ios --path ./build/saebom.ipa
# Proven alternative (Oct 24): raise ios.buildNumber, prebuild, then Xcode Product → Archive →
# Distribute App → App Store Connect. Steps in the handoff's §13.
```

## Before handing a PR to the owner

1. `npm run verify` passes, and CI is green.
2. Schema changes follow the database rules and come with pgTAP tests.
3. New behavior has tests; plan-engine changes keep the invariants and the property tests.
4. No secrets or health data in code, logs, notifications, audit events or prompts.
5. The app writes only `profiles` and `consents`; functions validate input and check `aal2`.
6. Rings, buttons and motion meet the accessibility rules.
7. Scope matches one §14 task, anything new is logged in §3, and this file is updated if a command or convention changed.
8. The second review is posted, and every confirmed finding is fixed or listed for the owner (D63).
