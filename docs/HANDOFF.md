# Saebom (새봄) — Handoff v2.13 (iOS app)

**Status (Oct 28, 2026):** planning and setup are finished (§13), and from v2.11 AI agents write the code under the owner's review. The bare Expo app runs in the Simulator and on the iPhone, and a first build was uploaded to TestFlight and installed on Oct 24. Build work hadn't started by Oct 28, the date of day 3: the GitHub repo held only its README and license, so §14 runs about three days behind. v2 (Oct 14) replaced v1 (Oct 13); v2.1 adds the owner's Oct 15 answers, v2.2 adds `CLAUDE.md`, the repo's memory file for Claude, v2.3 aligns §13's install list with `CLAUDE.md` and logs the exercise catalog decisions (D41–D45), v2.4 lets testers choose how the plan handles each injured area (D46–D47), v2.5 replaces the clearance step for training an injured area light with a direct warning the tester acknowledges (D46), v2.6 makes 6–8 reps the baseline for every exercise (D48), and v2.7 removes the last doctor gate, turning the readiness checklist into a warning, and adds comfort check-ins (D49–D50), v2.8 records the owner's answers to the catalog review (D51–D54), v2.9 fits the added work into the same ten days (§14), v2.10 records what setup proved on Oct 24 (D55–D57), v2.11 hands the coding to AI agents under the owner's review (D58–D65), v2.12 counts progress weeks in the tester's local time (D66), and v2.13 adds the autopilot that starts the next task after each merge (D67). §0 lists what changed.
**Name:** Saebom (새봄), Korean for "new spring": a fresh start. Until Oct 15 the working name was "Lifting Coach".
**Build window:** Mon Oct 26 – Fri Nov 6, 2026 — ten 4-hour sessions, 40 hours. AI agents write the code in small pull requests, and the owner reviews, tests and merges them (D58, D62); `docs/agent-workflow.md` is the how-to.
**Target on Nov 6:** the app running on the owner's iPhone from TestFlight, and the first build submitted for TestFlight App Review so friends and family can join.

This file holds every decision and spec needed to continue the work, and it contains no secrets. The project's three product goals: a workout plan for each user; reminders when today's workout isn't recorded; and a timed workout session that tracks weight and reps. The owner's build guide doc (https://claude.ai/code/artifact/f9dd3e2a-534b-4596-a2c0-3a488514fc48) explains the reasoning; where the two differ, this file wins.

---

## 0. What changed

| Area            | v1 (Oct 13)                                      | v2 (Oct 14)                                                                                                           |
| --------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Platform        | Web app (PWA) on Cloudflare Pages                | iOS app built with React Native (Expo); no website                                                                    |
| Distribution    | Public URL with a demo                           | TestFlight only, for friends and family; App Store listing later                                                      |
| Budget          | $0                                               | $100 a year; the Apple Developer Program ($99) is the only spend                                                      |
| Data            | Synthetic only                                   | Real workout data from invited testers who consent; synthetic data only in demo mode, tests and screenshots           |
| Consent         | One timestamp                                    | Per-user, recorded and versioned: a required data consent and an optional AI-coach consent, both withdrawable         |
| Accounts        | Invite-only, mechanism unspecified               | The owner's invite script hands out one-time codes; no email service; a Before User Created hook blocks everyone else |
| Reminders       | Web push through PushForge                       | Local notifications scheduled on the phone, skipped when today's workout is recorded                                  |
| Logging         | Sets written straight to the database            | A timed session recorded on the phone and uploaded once on Finish                                                     |
| Session timeout | Sign-out after 15 minutes idle                   | Face ID or passcode app lock after 15 minutes idle or in the background                                               |
| Rep ranges      | 3–15 reps by tier                                | 8 reps max by default, 10 with areas to avoid, 12 for new lifters with areas to avoid (absolute max)                  |
| Schedule        | Calendar days, with implied rescheduling         | Workouts rotate in order (A, B, C…); reminders on chosen weekdays                                                     |
| AI coach        | Weekly, plus "Ask the coach" daily               | Weekly only and opt-in; the button comes later                                                                        |
| Database access | The app reads and writes its own rows everywhere | The app writes only its profile and consents; functions write everything else                                         |

**Added in v2.1 (Oct 15):**

- The app is named **Saebom (새봄)** and gets a bold, sporty look built around circles, with smooth transitions (D37–D38).
- The owner is the whole team and the only person with access to production data (D29).
- Testers are adults in the US, outside Washington State (D30).
- After the beta comes a free public App Store app; §18 is its undated checklist (D32).
- v1 gains a small profile editor (areas to avoid and days per week) and short form cues for every exercise (D33–D34).
- Confirmed: required MFA, the Face ID lock, the rep ranges, loaded exercises only, and one pull request per day (D10, D23, D31, D35, D36).
- To make room, the trend line chart, the consent-history screen and automatic upload retry move after Nov 6, and demo mode starts with one synthetic lifter (D39).

**Added in v2.2:** `CLAUDE.md` at the repo root holds Claude's working rules, coding standards and exact commands, and this handoff moves into the repo as `docs/HANDOFF.md` on day 1 (D40).

**Added in v2.3 (Oct 15):**

- §13's install list now matches `CLAUDE.md`: Node 24 and Deno 2, and the Supabase CLI runs through `npx` instead of a global install. Enrollment, installs and accounts are ticked off.
- Claude's exercise catalog draft is in the project as `claude/exercise-catalog.md`, waiting for the owner's review (D34).
- The owner's answers on the catalog: the big four main lifts (D41), conservative body-region tags (D42), a second row in place of the vertical pull for dumbbells only (D43), an explicit swap list per exercise in a new `allowed_swaps[]` column (D44, §6), and six accessories (D45).

**Added in v2.4 (Oct 15):**

- When a tester flags an injured area, the app asks how the plan should handle it: "Train around it" works other muscle groups instead, and "Train it light" keeps that area in the plan with less weight and more reps (D46).
- "Train it light" shows a direct warning the tester must acknowledge (changed in v2.5; see below), uses no main lifts or barbells, caps reps at 12, offers a one-tap "Pain? Stop" in the session, and stays out of the AI coach's reach (D47). This amends D16's rep caps for light exercises only.
- New columns: `profiles.light_areas[]`, `profiles.light_ack_at` and `plan_items.is_light` (§6).

**Changed in v2.5:** "Train it light" no longer asks the tester to confirm a doctor's or physical therapist's clearance. Instead it shows a direct, plain warning that training an injury can make it worse, that they should only do it if they're certain it's safe, and that a doctor or physical therapist is the surest way to know. The tester acknowledges it before light training starts, and the app records when (`light_ack_at`, replacing `light_cleared_at`). The owner's reasons: a warning is owed before the app lets anyone train an injured area, but testers shouldn't have to see a doctor to use a fitness app (D46).

**Changed in v2.6:** 6–8 reps is the baseline for every exercise and every tester. Only new lifters (8–10) and injured testers get a different range (D48). The experienced row's 3–6 on main lifts is gone, so main lifts no longer have their own rep range; they still matter for swaps and light training (D41).

**Changed in v2.7 (Oct 16):**

- Nothing in the app requires a doctor's approval or blocks the plan for lack of one. The readiness checklist becomes a direct warning the tester acknowledges, as "Train it light" already does (D49).
- The app follows up on comfort: a quick check before each session, a nudge after a hard set, a check after each session, and a follow-up on the next visit if something hurt. Each one offers to lower the weight or reps (D50).
- "Pain? Stop" moves to every exercise card, not only light exercises (D50).
- The Apple Developer Program membership is pending; the App Store Connect record waits for it (§13).
- Decision dates from the v2.4–v2.6 changes are corrected to Oct 15, the day they were made.

**Added in v2.8 (Oct 16), from the owner's catalog review:**

- Every exercise is labeled with the muscle groups it works (shown to testers) and the joints and areas it loads (used for injuries), each graded great or light (D51).
- An injured tester chooses decreased intensity (train light) or avoiding the area completely (train around). Avoiding leaves out every exercise that loads the area, great or light, so the leg press drops out when the lower back is avoided but stays when it's trained light (D51).
- New lifters never get the deadlift; the Romanian deadlift is their hinge (D52).
- Cables and machines move in 5 lb steps from a 5 lb minimum, like dumbbells (D53).
- The machine shoulder press and single-arm cable pulldown join the catalog, so every compound lift has a swap: 25 exercises (D54).
- Swaps into main lifts stay blocked, for safety (D41).

**Changed in v2.9 (Oct 16):** the work added in v2.4–v2.8 (train light, the warnings, comfort check-ins, "Pain? Stop" on every card, graded labels) goes into the existing ten days, with no days added. Day 2 takes the new plan rules, and day 7 takes the after-session check-ins and Settings → Training from days 5 and 8 (§14). The owner accepted the extra hours.

**Added in v2.10 (Oct 25), from setup on Oct 24:**

- The app record "Saebom" exists in App Store Connect with bundle ID `com.rrim.saebom`, so the name is reserved (D37).
- The project lives at `~/Development/saebom` on the owner's Mac (D55). The GitHub repo is `rryan1010/saebom` (D57); on Oct 25 it held only GitHub's initial README and Apache 2.0 license, and the local folder wasn't linked to it yet.
- Xcode's User Script Sandboxing is turned off by a config plugin, `app/plugins/withNoScriptSandbox.js`, and `app/ios/` is generated and git-ignored (D56).
- The release path is proven: Xcode archive → Distribute → App Store Connect → internal TestFlight. §13 lists the steps and the errors met on the way.
- The catalog read-through is done, so every pre-build task is finished.

**Added in v2.11 (Oct 28), the agent workflow:**

- AI agents write the code, and the owner reviews, tests on the iPhone and merges. This replaces D10's split, where the owner coded and Claude reviewed (D58).
- pstack, poteto's skill pack for Claude Code, runs each task; Noodle, his scheduling loop, waits until after Nov 6 (D59).
- Agent sessions run in Claude Code on the owner's Mac, each task in its own git worktree, at most two at a time (D60).
- Product questions go to the owner as GitHub issues labeled `question`, and each answer becomes a D-numbered decision in the next pull request (D61).
- One pull request per task instead of one per build day (D62).
- Every pull request gets a second review from the other model family: Gemini, through Antigravity CLI, reviews Claude's work, and Claude reviews Gemini's (D63).
- No extra AI spend: agents run within Claude Pro and Google AI Pro, effort never drops below medium, and Gemini 4 Argon takes over a task when Claude's limits run out (D64).
- A guard hook and deny rules enforce `CLAUDE.md`'s "Never" list for both agents (D65).
- `CLAUDE.md` and this handoff (`docs/HANDOFF.md`) enter the repo with the agent-workflow pull request, together with `AGENTS.md`, `GEMINI.md`, `docs/agent-workflow.md`, `.claude/`, `.agents/` and `scripts/agents/` (§5). From that merge, the repo copies are canonical (D40).

**Added in v2.12 (Oct 30):**

- Progress weeks run Monday to Sunday in the tester's local time; each session stores the phone's UTC offset (D66).

**Added in v2.13 (Oct 30):**

- The owner can run the autopilot (`npm run autopilot`): after each merge it opens a Claude Code session on the next §14 task, and it logs pull requests, second reviews and questions as they happen (D67).

## 1. Goal and constraints

- **Product:** Saebom, an iPhone app for gym weightlifting. It builds a safe starting plan, runs a timed workout session that tracks weight and reps, reminds users to train when today's workout isn't recorded, and adapts the plan weekly through an AI coach whose suggestions the user approves.
- **Users for now:** invited friends and family through TestFlight, all adults in the US and none in Washington State. A free public App Store release follows the beta, with no date yet (§18).
- **Team:** the owner alone, holding every account.
- **Also:** a portfolio piece with security talking points: MFA enforced by the database, AI output treated as untrusted input, consent by design.
- **Time:** 40 hours, Oct 26 – Nov 6, plus about 3 hours of setup before Oct 26 (§13).
- **Budget:** $100 a year during the beta. The Apple Developer Program costs $99; everything else runs on free tiers. The public launch adds only a domain, about $10–15 a year (§18).
- **Hardware:** the owner's Mac (for Xcode) and iPhone. iOS only: no Android, no website.
- **Data:** real data from invited testers, collected only after recorded consent. Synthetic data in demo mode, tests and screenshots.
- **Security:** basic but real, documented against HIPAA's technical safeguards and the OWASP Mobile Top 10.

## 2. The product

Tabs: **Today · Progress · Coach · Settings**, plus the session screen.

- **Plan:** fixed rules build a starting plan (§7). Workouts rotate in order (A, B, C…), and the first pass through the rotation is the calibration pass. Every exercise shows 2–3 short form cues. For each injured area, the tester chooses whether the plan trains around it or trains it light (§7). The app checks in on comfort before and after every session and offers to go lighter (§8).
- **Start session:** a large ring with the elapsed time in its center, today's exercises with target weight and rep range, quick weight × reps entry for each set, how hard it felt, and a badge for new rep records. Works offline; Finish uploads the session (§8).
- **Progress:** sessions this week as a ring against the plan, rep records by exercise and weight, and each lift's best estimated one-rep max.
- **Reminders:** local notifications on the weekdays and at the time the user picks, skipped when today's workout is already recorded, plus a weekly nudge when the week is behind plan (§9).
- **AI coach (opt-in):** once a week, up to 3 changes from a fixed menu, checked by code; the user accepts or dismisses each (§10).
- **Settings:** reminders; injured areas (each trained around or trained light) and days per week, which rebuild the plan when changed; the AI coach switch; export; account deletion; sign out (§11).
- **Account and privacy:** invite-only accounts, authenticator-app MFA, Face ID lock, consent, data export, in-app account deletion and a demo mode (§11).
- **Look:** bold and sporty, dark-first, built around circles: the session ring, progress rings and round primary buttons, with smooth transitions (§8).

**Out of scope for now:** nutrition, cardio, Apple Health and wearables, social features, payments, Android, a website, bodyweight exercises and a public App Store listing. Deferred until after Nov 6: the trend line chart, a consent-history screen, automatic upload retry, two more demo lifters, a rest timer, kilograms, editing the rest of the profile and an "Ask the coach" button.

**Done means (Nov 6):**

- [ ] The app runs on the owner's iPhone from a TestFlight build (internal testing).
- [ ] An external "Friends & family" group exists and the build is submitted for TestFlight App Review; approval may land after Nov 6.
- [ ] The invite flow works end to end: invite → sign in with a code → password → MFA → consent → onboarding → plan.
- [ ] A full calibration pass is logged on the iPhone and next targets appear.
- [ ] A public GitHub repo with a README, architecture diagram, threat model and HIPAA mapping; CI runs unit, property and RLS tests and security scans on every push.

**After Nov 6:** invite testers once the beta review passes, record the 3-minute demo video, then pick up the deferred items and the public-launch checklist (§18).

## 3. Decisions (keep unless the owner changes them)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Reason                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Weightlifting only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Fits 40 hours                                                                                                                                                                                                                                    |
| D2  | The starting plan comes from fixed rules, never AI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Safe, explainable, testable; owner's requirement                                                                                                                                                                                                 |
| D3  | AI only adapts plans weekly: a fixed menu of changes, checked by code, approved by the user                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Personalization without unsafe output                                                                                                                                                                                                            |
| D4  | **Changed Oct 14.** Stack: an Expo (React Native, TypeScript, Expo Router) iOS app + Supabase Free (Postgres, Auth, Edge Functions, Cron) + Cloudflare Workers AI + GitHub Actions                                                                                                                                                                                                                                                                                                                                                             | App-first; React skills carry over; one language                                                                                                                                                                                                 |
| D5  | Coach model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with JSON Mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Largest general-purpose model with JSON Mode on Workers AI; fits the free allowance                                                                                                                                                              |
| D6  | Don't use Gemini's free tier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Google uses free-tier prompts and responses to improve its products                                                                                                                                                                              |
| D7  | HIPAA doesn't legally cover this app; build and document against its technical safeguards anyway                                                                                                                                                                                                                                                                                                                                                                                                                                               | A recognized bar; the FTC rule and state law are what can apply                                                                                                                                                                                  |
| D8  | **Changed Oct 14.** Demo mode uses anonymous sign-ins with synthetic data. Real accounts are invite-only (invite script + Before User Created hook), MFA is required and manual linking stays off                                                                                                                                                                                                                                                                                                                                              | Sign-ups must stay on for anonymous sign-ins to work, so the hook enforces invites                                                                                                                                                               |
| D9  | Notifications never contain health data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Lock screens are visible to others; Apple's push guideline 4.5.4 says the same                                                                                                                                                                   |
| D10 | **Changed Oct 28 (D58).** Was: the owner codes, and Claude reviews one GitHub pull request per day                                                                                                                                                                                                                                                                                                                                                                                                                                             | Owner's choice (Oct 14), confirmed Oct 15; replaced by D58 on Oct 28                                                                                                                                                                             |
| D11 | iOS only, distributed through TestFlight to friends and family; no public listing yet                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Owner's call (Oct 14)                                                                                                                                                                                                                            |
| D12 | Budget of $100 a year during the beta; the Apple Developer Program is the only spend                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Owner's call (Oct 14)                                                                                                                                                                                                                            |
| D13 | Real data from invited testers only after recorded consent; synthetic data in demo mode, tests and screenshots                                                                                                                                                                                                                                                                                                                                                                                                                                 | Testers will log their real training                                                                                                                                                                                                             |
| D14 | Per-user consent, recorded and versioned: required (store workouts and health information) and optional (AI coach), both withdrawable                                                                                                                                                                                                                                                                                                                                                                                                          | Owner's requirement; Apple guidelines 5.1.1–5.1.2; Washington's My Health My Data Act                                                                                                                                                            |
| D15 | Profile precedence: areas to avoid, then new lifter, then experienced (or intermediate with an intense goal), then intermediate. An intense goal never moves a new lifter up                                                                                                                                                                                                                                                                                                                                                                   | Safety                                                                                                                                                                                                                                           |
| D16 | Rep caps: 8 by default, 10 for new lifters (v2.6, D48), 10 with areas to avoid, 12 for new lifters with areas to avoid (absolute max). The estimated max uses sets of 12 reps or fewer. **Amended Oct 15:** light exercises take 10–12 reps for every profile, still never above 12 (D47)                                                                                                                                                                                                                                                      | Owner's rule (Oct 14); every set then feeds the estimate                                                                                                                                                                                         |
| D17 | Workouts rotate in order (A, B, C…); reminders fire on weekdays the user picks                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No rescheduling logic needed                                                                                                                                                                                                                     |
| D18 | Pounds only in v1, stored as pounds; kilograms later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Owner wanted per-user units, then allowed kilograms to slip to fit 40 hours                                                                                                                                                                      |
| D19 | The coach runs once a week from a Sunday cron; no "Ask the coach" button in v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Keeps the one-row-per-user-per-week key idempotent; cut to fit                                                                                                                                                                                   |
| D20 | Local notifications scheduled on the phone; no push server and no stored device tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Simplest, most private, works offline                                                                                                                                                                                                            |
| D21 | Sessions are recorded on the phone and uploaded once on Finish to `finish-workout`                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Gyms often have poor signal; one validated, atomic write                                                                                                                                                                                         |
| D22 | Session-to-session targets live in `next_targets`; plan versions change only for rules-built plans and accepted coach changes                                                                                                                                                                                                                                                                                                                                                                                                                  | Plans stay versioned without a new version after every session                                                                                                                                                                                   |
| D23 | App lock with Face ID or passcode after 15 minutes idle or in the background, instead of signing out                                                                                                                                                                                                                                                                                                                                                                                                                                           | Automatic logoff that works on a phone; confirmed Oct 15                                                                                                                                                                                         |
| D24 | Published under the owner's individual Apple developer account                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Owner's call (Oct 14); revisit before the public launch (Apple 5.1.1(ix), §18)                                                                                                                                                                   |
| D25 | Data minimization: an 18+ confirmation instead of an age range; readiness answers stay on the phone; "areas to avoid" instead of injury details; no location, analytics or ad SDKs                                                                                                                                                                                                                                                                                                                                                             | Less sensitive data to hold                                                                                                                                                                                                                      |
| D26 | No email service in the beta: invites and password resets use one-time codes from the owner's script                                                                                                                                                                                                                                                                                                                                                                                                                                           | $0 and no third party; fine for a small invited group                                                                                                                                                                                            |
| D27 | Nightly encrypted database backup from GitHub Actions to a private bucket in a second free Supabase project; the same job keeps the project active                                                                                                                                                                                                                                                                                                                                                                                             | Supabase Free has no automatic backups and pauses idle projects                                                                                                                                                                                  |
| D28 | Cut to fit 40 hours: website, web push, kilograms, "Ask the coach" button, rest timer, editing the profile beyond areas and days, Android; the demo video moves after Nov 6                                                                                                                                                                                                                                                                                                                                                                    | Owner chose "cut to fit" (Oct 14)                                                                                                                                                                                                                |
| D29 | The owner is the whole team: the sole holder of every account and the only person with access to production data                                                                                                                                                                                                                                                                                                                                                                                                                               | Owner's answer (Oct 15)                                                                                                                                                                                                                          |
| D30 | Testers are adults in the US outside Washington State; the app stays 18+                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Owner's answer (Oct 15); keeps children's and EU privacy law out of the beta                                                                                                                                                                     |
| D31 | Authenticator-app MFA stays required for every real account                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed Oct 15; Face ID covers daily unlocks, so codes are needed mainly at setup                                                                                                                                                              |
| D32 | After the beta: a free public App Store app, planned as an undated checklist (§18). Phase 2 adds only a domain (about $10–15 a year) and stays on Supabase Free with the nightly backups                                                                                                                                                                                                                                                                                                                                                       | Owner's answers (Oct 15)                                                                                                                                                                                                                         |
| D33 | v1 lets users edit areas to avoid and days per week; saving rebuilds the plan as a new version                                                                                                                                                                                                                                                                                                                                                                                                                                                 | A tester who gets hurt mid-beta must be able to flag it                                                                                                                                                                                          |
| D34 | Every exercise carries 2–3 short form cues; Claude drafts the catalog and its cues for the owner to review before day 2                                                                                                                                                                                                                                                                                                                                                                                                                        | New lifters need safety guidance; saves the owner's build hours                                                                                                                                                                                  |
| D35 | Loaded exercises only; no bodyweight moves in v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Keeps every set's weight above zero; machines stand in, such as the lat pulldown for pull-ups                                                                                                                                                    |
| D36 | Rep ranges: 6–8 by default, 8–10 for new lifters (v2.6, D48), 8–10 with areas to avoid, 10–12 for new lifters with areas to avoid                                                                                                                                                                                                                                                                                                                                                                                                              | Owner confirmed Claude's bottoms (Oct 15)                                                                                                                                                                                                        |
| D37 | Name: Saebom (새봄). App Store name "Saebom", reserved Oct 24 with the App Store Connect record; bundle ID `com.rrim.saebom`. (Fallbacks "Saebom 새봄" and "Saebom: Lifting Coach" weren't needed.)                                                                                                                                                                                                                                                                                                                                            | Owner's choice (Oct 15): a Korean word for a fresh start; a web search found no app with the name                                                                                                                                                |
| D38 | Look: bold and sporty, dark-first, built around circles with smooth transitions; nothing resembling Apple's Activity rings                                                                                                                                                                                                                                                                                                                                                                                                                     | Owner's direction (Oct 15); Apple guideline 5.2.5                                                                                                                                                                                                |
| D39 | To fit D33, D34 and D38 into 40 hours: the trend line chart, the consent-history screen and automatic upload retry move after Nov 6; demo mode starts with one synthetic lifter; the README stays lean                                                                                                                                                                                                                                                                                                                                         | Keeps the deadline without cutting tests or safety                                                                                                                                                                                               |
| D40 | `CLAUDE.md` at the repo root is Claude's memory: working rules, coding standards, npm scripts and exact commands. From day 1 the repo copy of this handoff (`docs/HANDOFF.md`) is canonical; refresh the project copy after changes. **Amended Oct 28:** both files enter the repo with the agent-workflow pull request, and `AGENTS.md` links to `CLAUDE.md` so every agent reads the same rules                                                                                                                                              | Owner's request for a persistent memory file; one source of truth per topic                                                                                                                                                                      |
| D41 | **Changed in v2.6.** Main lifts are the back squat, bench press, deadlift and overhead press. They have no rep range of their own (D48); the flag keeps them out of coach swaps (D44) and light training (D47)                                                                                                                                                                                                                                                                                                                                 | Owner's choice (Oct 15); the 3–6 range was dropped in v2.6. Swap block confirmed Oct 16: the coach would move someone onto a heavy barbell lift with no history, so the checker can't verify a safe starting weight                              |
| D42 | Body-region tags are conservative: each exercise is tagged with every region it puts under real load. The wrist is tagged when it must hold its angle against the load (presses, curls, pushdowns), not for a hanging grip (deadlifts, rows). **Graded in v2.8 (D51):** each tag is great or light                                                                                                                                                                                                                                             | Owner's choice (Oct 15); for testers who flag an area, safety beats variety                                                                                                                                                                      |
| D43 | The dumbbells-only setup has no loaded vertical pull; the plan fills that slot with a second row variant (the chest-supported dumbbell row). The setup assumes dumbbells plus an adjustable bench                                                                                                                                                                                                                                                                                                                                              | Owner's choice (Oct 15); pull-ups are bodyweight (D35)                                                                                                                                                                                           |
| D44 | Each exercise carries an explicit `allowed_swaps[]` list of slugs with the same movement pattern; the coach checker accepts only swaps on that list                                                                                                                                                                                                                                                                                                                                                                                            | Owner's choice (Oct 15); gives §10's "allowed list" a home and keeps control over every swap                                                                                                                                                     |
| D45 | Accessories: dumbbell curl, triceps pushdown, dumbbell lateral raise, leg curl, leg extension and dumbbell calf raise                                                                                                                                                                                                                                                                                                                                                                                                                          | Owner's choice (Oct 15)                                                                                                                                                                                                                          |
| D46 | **Changed in v2.5.** For each injured area, the tester chooses "Train around it" (the default: the plan leaves out every exercise that loads it and works other muscle groups) or "Train it light" (that area stays in the plan with less weight and more reps). Choosing "Train it light" shows a direct warning: training an injured area can make it worse, do it only if you're certain it's safe, and a doctor or physical therapist is the surest way to know. The tester must acknowledge it; no doctor's note or clearance is required | Owner's request (Oct 15); the owner changed the clearance step to a warning in v2.5, because a clear warning is owed before training an injury, but testers shouldn't have to see a doctor to use a fitness app                                  |
| D47 | Light exercises: exercises that load a light area, aren't main lifts, don't use a barbell and load no area being trained around. They get 2 sets of 10–12 reps with 4+ in reserve in every profile row, never above 12. The weight goes up only when every set reaches 12 reps and none felt hard. A "Pain? Stop" button ends the exercise and offers to switch the area to "Train around it". The AI coach never sees or changes light exercises                                                                                              | Owner's request (Oct 15) for less weight and more reps; limits the risk of loading an injured area                                                                                                                                               |
| D48 | 6–8 reps is the baseline for every exercise and every tester, main lifts included. Only new lifters, who start at 8–10, and testers with an injured area get a different range (§7). Nobody without an injured area gets more than 10 reps; 12 is reserved for injured testers                                                                                                                                                                                                                                                                 | Owner's rule (Oct 15, v2.6)                                                                                                                                                                                                                      |
| D49 | No screen requires a doctor's approval or denies the plan for lack of one. The readiness checklist shows a direct warning the tester acknowledges, then onboarding continues whatever the answers                                                                                                                                                                                                                                                                                                                                              | Owner's rule (Oct 16): a clear warning is owed, but testers shouldn't have to see a doctor to use a fitness app; same reasoning as D46                                                                                                           |
| D50 | Comfort check-ins: before each session ("How are you feeling today?"), after a set rated hard or below the rep range, after each session ("How did that feel?"), and on the next app open after a session where something hurt. Each offers to lower weight or reps, never raises them. "Pain? Stop" is on every exercise card. The answers stay on the phone; only the choice to go lighter reaches the server                                                                                                                                | Owner's request (Oct 16): testers should feel comfortable with each workout and be reminded to lower weight or reps when needed                                                                                                                  |
| D51 | Every exercise carries two sets of labels, each graded **great** (the main work) or **light** (helps, or loaded less): the muscle groups it works (legs, back, chest, shoulders, arms, core; one great, at most one light), shown on the exercise card, and the joints and areas it loads (D42's regions), used for injuries. Avoiding an area completely leaves out every exercise that loads it, great or light. Decreased intensity keeps exercises that load it either way, except main lifts and barbell lifts (D47)                      | Owner's answer to catalog question 6 (Oct 16); e.g. the back squat works the legs (great) and the back (light). Settles question 2: the leg press loads the lower back light                                                                     |
| D52 | New lifters (under 6 months) are never given the deadlift; the Romanian deadlift is their hinge. Everyone else is cued to raise the bar on blocks when small plates leave it low                                                                                                                                                                                                                                                                                                                                                               | Owner's answer to catalog question 3 (Oct 16)                                                                                                                                                                                                    |
| D53 | Cables and machines move in 5 lb steps with a 5 lb minimum load, like dumbbells                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Owner's answer to catalog question 4 (Oct 16); 10 lb jumps are too big on light accessories                                                                                                                                                      |
| D54 | The machine shoulder press and single-arm cable pulldown are added and swap with the seated dumbbell shoulder press and lat pulldown; every compound lift has at least one swap. 25 exercises                                                                                                                                                                                                                                                                                                                                                  | Owner's answer to catalog question 5 (Oct 16)                                                                                                                                                                                                    |
| D55 | The project lives at `~/Development/saebom` on the owner's Mac, never in Downloads, Desktop or an iCloud-synced folder                                                                                                                                                                                                                                                                                                                                                                                                                         | Setup, Oct 24: moving the folder left a Metro server and CocoaPods pointing at the old path; Downloads is also privacy-protected by macOS                                                                                                        |
| D56 | `app/plugins/withNoScriptSandbox.js`, an Expo config plugin listed in `app.json`, sets `ENABLE_USER_SCRIPT_SANDBOXING = NO` on every build configuration. `app/ios/` is generated by `npx expo prebuild`, never edited by hand, and git-ignored                                                                                                                                                                                                                                                                                                | Setup, Oct 24: Xcode's sandbox blocked CocoaPods' "[CP] Copy Pods Resources" step. A plugin survives every regeneration; a hand edit in Xcode wouldn't. Owner chose to git-ignore `ios/` (Oct 25)                                                |
| D57 | The public GitHub repo is `rryan1010/saebom`, licensed Apache 2.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Owner created it before day 1                                                                                                                                                                                                                    |
| D58 | AI agents write the code. The owner reviews each pull request, tests it on the iPhone when it changes the app, and merges it. Agents never merge, approve their own work or touch production                                                                                                                                                                                                                                                                                                                                                   | Owner's choice (Oct 28); replaces D10. Speeds up a build that hadn't started by day 3, while every change still passes the owner's review                                                                                                        |
| D59 | pstack (poteto's skill pack, the Claude Code build from `cursor/plugins`) runs each task through `/pstack:poteto-mode`. Noodle's scheduling loop waits until after Nov 6, for the post-beta backlog                                                                                                                                                                                                                                                                                                                                            | Owner's choice (Oct 28). Noodle merges finished work into the local `main` and runs agents with permission checks off, which conflicts with the pull-request rule and D65, and its setup doesn't fit the build window (`docs/agent-workflow.md`) |
| D60 | Agent sessions run in Claude Code on the owner's Mac, one task per git worktree (`claude -w`), at most two at a time. `.worktreeinclude` copies `app/.env.local` and `supabase/functions/.env.local` into each worktree, never `scripts/.env.local`                                                                                                                                                                                                                                                                                            | Owner's answer (Oct 28): the local Supabase stack needs Docker and the app needs the Simulator, which cloud sessions lack; Claude Pro's limits allow about one or two sessions                                                                   |
| D61 | Product questions that the handoff doesn't answer and no experiment can settle become GitHub issues labeled `question` (the ask-owner skill). The agent keeps working on whatever the question doesn't block, never guesses a safety rule, and logs the owner's answer as a D-number in the next pull request (the log-decision skill)                                                                                                                                                                                                         | Owner's answer (Oct 28); issues reach the owner's phone and leave a record the decision log can cite                                                                                                                                             |
| D62 | One pull request per task, not per build day: branches named `<type>/<topic>`, Conventional Commits titles, and each §14 item ticked in the pull request that finishes it                                                                                                                                                                                                                                                                                                                                                                      | Owner's answer (Oct 28); smaller reviews, and each pull request fits in one Gemini review                                                                                                                                                        |
| D63 | Every pull request gets a second review from the other model family before the owner merges it. Gemini 4 Argon, through Antigravity CLI (`agy -p`, run by `scripts/agents/gemini-review.ts`), reviews Claude's pull requests, and Claude reviews Gemini's. Only the diff and the pull request's text are sent, after a secret check, and findings are checked and posted on the pull request                                                                                                                                                   | Owner's answer (Oct 28). Google's terms for Google AI Pro don't say whether prompts train its models, the concern behind D6, so only code bound for the public repo is sent; the app itself never uses Gemini                                    |
| D64 | No extra AI spend: agents run within the owner's Claude Pro and Google AI Pro subscriptions, with no usage credits, API keys or Fable. Effort can drop to medium when limits are tight, never lower. When Claude's limits run out partway through a task, the owner continues it in Antigravity CLI on the latest Gemini flagship (Gemini 4 Argon as of Oct 28), under the same rules and guard                                                                                                                                                | Owner's answer (Oct 28). Fable bills to usage credits on Pro; Claude's and Gemini's limits are separate                                                                                                                                          |
| D65 | A guard hook (`scripts/agents/guard.mjs`, run by Claude Code and by Antigravity CLI) and deny rules in `.claude/settings.json` block production and account commands, pushes to `main`, force-pushes, merges, secret files, edits to the guardrails, agents started with permission checks off, and subagents below medium effort. Bypass mode is disabled for the project, and agents never edit the guardrails                                                                                                                               | `CLAUDE.md` guides agents but enforces nothing. Claude Code's deny rules hold in every permission mode; Antigravity skips hooks under `--dangerously-skip-permissions`, so that flag is banned                                                   |
| D66 | Progress weeks run Monday to Sunday in the tester's local time. Each session stores the phone's UTC offset when it started (`workout_sessions.utc_offset_min`), and `e1rm_by_week` groups by that local week. The coach's `week_start` stays the ISO Monday in UTC, because it only keys the weekly run                                                                                                                                                                                                                                        | Owner's call (Oct 30), on PR #3. An offset per session stays right when a tester travels or the clocks change, and stores no place name (D25)                                                                                                    |
| D67 | The owner can run `scripts/agents/autopilot.sh` (`npm run autopilot`) on the Mac. When the owner merges a pull request, none is left open and no session it started is still running, it opens a Claude Code session in a new worktree on the next §14 task. It logs merges, new pull requests, posted second reviews and question issues, with Mac notifications. It never merges, pushes or touches production                                                                                                                               | Owner's request (Oct 30): no idle time between a merge and the next task, while the owner follows progress as it happens. It polls GitHub every minute rather than keeping the Mac awake, since the Mac is usually on                            |

Log any new decision here with its reason.

## 4. Architecture

```
iPhone: Saebom (Expo / React Native)
  - Keychain (expo-secure-store, this device only): the auth session
  - App storage: the in-progress workout session, until Finish uploads it
  - Local notifications (expo-notifications): reminders scheduled on the phone
  - Face ID or passcode lock (expo-local-authentication)
      |  HTTPS only (iOS App Transport Security)
      v
Supabase (Free)
  - Auth: password + authenticator-app (TOTP) MFA; anonymous demo sessions;
          a Before User Created hook admits anonymous users and invited emails only
  - Postgres + RLS: the app reads its own rows and writes only its profile and consents
  - Edge Functions, called with the user's token: generate-plan, finish-workout,
          accept-suggestion, export-data, delete-account, seed-demo
  - Cron (pg_cron + pg_net, key in Vault): coach-review weekly; nightly SQL jobs
      |
      v
Cloudflare Workers AI: anonymous weekly summary in, JSON changes out (opted-in users only)

GitHub Actions: CI (tests, RLS tests, CodeQL); deploy migrations and functions from main;
                nightly encrypted backup to the second Supabase project, plus a keep-alive call
Owner's Mac:    Xcode build -> App Store Connect -> TestFlight -> testers' iPhones
                invite script (secret key in a git-ignored scripts/.env.local)
                AI agents: Claude Code with pstack; Antigravity CLI (Gemini) for second reviews
                and when Claude's limits run out (D58–D65)
```

The app holds only the project URL and the publishable key. Server-side keys live in Edge Function secrets, Vault, GitHub Actions secrets or the owner's Mac (§12, Secrets).

### Free tiers and limits (checked Oct 13–14, 2026; recheck on day 1)

| Service                         | What matters                                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Free                   | 500 MB database, 50,000 monthly active users, 500,000 function calls, 1 GB storage, 5 GB egress, 2 active projects, basic MFA. **No automatic backups; pauses after a week idle**                                                   |
| Cloudflare Workers AI           | 10,000 neurons a day; on Workers Free, requests fail past that; resets 00:00 UTC                                                                                                                                                    |
| Expo (EAS) Free                 | 15 iOS cloud builds a month (low priority, 45-minute timeout); EAS Submit included. Builds made on the Mac use none of these                                                                                                        |
| TestFlight (in the $99 program) | Up to 100 internal testers, who must be App Store Connect team members; up to 10,000 external testers by email invite or public link; the first build for external testers needs TestFlight App Review; builds expire after 90 days |
| GitHub, public repo             | Actions minutes on standard runners, CodeQL and secret scanning are free                                                                                                                                                            |

**AI budget:** about 122 neurons per review (1,500 tokens in, 400 out), so about 80 reviews a day; a friends-and-family beta uses a small fraction. Backup model: `@cf/meta/llama-3.1-8b-instruct`, about 68 neurons per review.

### Free-tier gaps and workarounds

- No automatic backups → a nightly encrypted dump to the second project (§12).
- Pauses after a week idle → the nightly job also calls the API; confirm the project is awake before inviting testers and before TestFlight review.
- No session timeouts → the app lock (D23); signing out revokes the refresh token.
- Short auth-log retention → our own `audit_events` table.
- No email in the budget → the invite script with one-time codes (D26).
- No leaked-password protection → MFA required and a minimum password length of 12.

## 5. Repo layout

```
saebom/
├─ CLAUDE.md                     agents' memory: rules, standards, commands (D40); AGENTS.md links to it
├─ GEMINI.md                     what differs when Antigravity CLI does the work (D63–D64)
├─ README.md  LICENSE (Apache 2.0)  package.json  vitest.config.ts  tsconfig.json  .nvmrc  .prettierrc
├─ .gitignore  .worktreeinclude   secrets and worktrees stay out of git; env files copied into worktrees (D60)
├─ app/                          Expo app (TypeScript, Expo Router)
│  ├─ app/                       routes: (auth)/ (onboarding)/ (tabs)/ session/
│  ├─ src/lib/                   Supabase client, Keychain storage, app lock, reminders, session store
│  ├─ src/ui/                    theme tokens, Ring and RoundButton components, transitions
│  ├─ app.json                   bundle ID, Face ID text, privacy manifest, encryption flag
│  ├─ eas.json  metro.config.js  eslint.config.js
│  ├─ plugins/withNoScriptSandbox.js   config plugin: turns off Xcode's User Script Sandboxing (D56)
│  ├─ ios/                       generated by `npx expo prebuild`; never edited, git-ignored (D56)
│  └─ .env.local                 EXPO_PUBLIC_* values (git-ignored; .env.example is committed)
├─ supabase/
│  ├─ config.toml                local stack, auth settings, coach-review's verify_jwt = false
│  ├─ migrations/                tables, RLS, grants, triggers, views, hook, internal functions
│  ├─ seed.sql                   exercise catalog with cues, and demo templates
│  ├─ tests/                     pgTAP RLS tests
│  └─ functions/
│     ├─ _shared/rules/          plan engine and progression (pure TypeScript)
│     ├─ _shared/coach/          summary builder and checker (pure TypeScript)
│     ├─ generate-plan/  finish-workout/  accept-suggestion/  coach-review/
│     ├─ export-data/  delete-account/  seed-demo/
│     └─ .env.local              local function secrets (git-ignored)
├─ scripts/
│  ├─ invite.ts                  owner-only; reads the secret key from scripts/.env.local (git-ignored)
│  └─ agents/                    guard.mjs, the guard hook (D65); guard-agy.sh; gemini-review.ts (D63); tests
├─ .claude/                      settings.json (deny rules, hooks, pstack), rules/pstack-models.md, skills/
├─ .agents/hooks.json            Antigravity CLI's guard hook (D65)
├─ docs/                         HANDOFF.md, agent-workflow.md, threat-model, hipaa-mapping, privacy-policy,
│                                emergency-access, incident-response
└─ .github/                      workflows/ (ci.yml, deploy.yml, backup.yml), dependabot.yml, ISSUE_TEMPLATE/question.yml
```

- `CLAUDE.md` lists the npm scripts (root and `app/`) and the command each one runs; `npm run verify` runs every check, and CI runs the same.

- Keep `_shared/` free of Deno- and Node-only APIs and use explicit `.ts` import extensions, which Deno needs. The app imports it through Metro: add the folder to `watchFolders` in `metro.config.js` and set `allowImportingTsExtensions` in the app's tsconfig. If Metro fights, fall back to a script that copies `_shared/` into `app/src/shared/` before each run.
- Test `_shared/` with Vitest from the repo root.

## 6. Data model

| Table               | Key columns                                                                                                                                                                                                                                                | App can                      | Written by                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `profiles`          | id (the user), experience, goal_intensity, days_per_week (2–6), equipment, avoid_areas[] (trained around), light_areas[] (trained light, D46), light_ack_at (when the light-training warning was acknowledged), adult_confirmed_at, readiness_ack_at (D49) | read, insert, update its own | App                                                    |
| `consents`          | user_id, kind (`data` or `ai_coach`), policy_version, granted, created_at                                                                                                                                                                                  | read, insert its own         | App; append-only                                       |
| `invites`           | email (unique, lowercase), created_at                                                                                                                                                                                                                      | nothing                      | Invite script; read by the hook                        |
| `exercises`         | slug, name, movement_pattern, equipment[], muscle_great, muscle_light (D51), regions_great[], regions_light[] (D51), increment_lb, min_load_lb, is_main_lift, allowed_swaps[] (D44), cues[]                                                                | read                         | Seed                                                   |
| `plans`             | user_id, version, source (`rules` or `coach`), status, created_at                                                                                                                                                                                          | read its own                 | Functions                                              |
| `plan_items`        | plan_id, user_id, day_label, position, exercise_slug, sets, rep_min, rep_max, rir, is_light (D47), start_weight_lb (empty during calibration)                                                                                                              | read its own                 | Functions                                              |
| `workout_sessions`  | user_id, client_id (unique), plan_id, day_label, started_at, ended_at, duration_s, utc_offset_min (D66), went_lighter (D50)                                                                                                                                | read its own                 | `finish-workout`                                       |
| `set_logs`          | user_id, session_id, exercise_slug, set_index, weight_lb, reps, effort (1–3)                                                                                                                                                                               | read its own                 | `finish-workout`                                       |
| `rep_records`       | user_id, exercise_slug, weight_lb, best_reps, achieved_at; unique (user_id, exercise_slug, weight_lb)                                                                                                                                                      | read its own                 | Trigger on `set_logs`                                  |
| `next_targets`      | user_id, exercise_slug, target_weight_lb, rep_min, rep_max, rir, below_range_streak; unique (user_id, exercise_slug)                                                                                                                                       | read its own                 | `finish-workout`, `accept-suggestion`, `generate-plan` |
| `lighter_weeks`     | user_id, week_start, source (`rules` or `coach`)                                                                                                                                                                                                           | read its own                 | Functions                                              |
| `coach_suggestions` | user_id, week_start, changes (JSON), checker_log (JSON), status (`pending`, `accepted`, `dismissed`, `expired`); unique (user_id, week_start)                                                                                                              | read its own                 | Functions                                              |
| `audit_events`      | actor (no foreign key), action, subject, details (never health values), created_at                                                                                                                                                                         | read its own                 | Functions and triggers only                            |
| `ai_usage`          | day, calls                                                                                                                                                                                                                                                 | nothing                      | `coach-review`                                         |

The view `e1rm_by_week` is created `with (security_invoker = true)`, so RLS applies to it. It uses the Epley formula `w × (1 + r/30)` over sets of 12 reps or fewer, takes the weight itself for single reps, and keeps the best value per exercise per week. Weeks run Monday to Sunday in the tester's local time, from each session's `utc_offset_min` (D66).

- RLS is enabled on every table, including `invites` and `ai_usage`; no policies means no app access.
- Every `user_id` references `auth.users(id) on delete cascade`. `audit_events.actor` has no foreign key, so the record of an account deletion survives it.
- Check constraints: `0 < weight_lb ≤ 1500`, `1 ≤ reps ≤ 100`, `rep_max ≤ 12`, `started_at ≤ ended_at`. On `profiles`: no area in both `avoid_areas` and `light_areas`, and `light_ack_at` is set whenever `light_areas` isn't empty. On `plan_items`: an `is_light` item has 2 sets, `rep_min = 10` and `rep_max = 12`.
- Grant only what the app needs: `select` on read-only tables; `select`, `insert` and `update` on `profiles`; `select` and `insert` on `consents`; nothing on `invites` or `ai_usage`. Newer Supabase projects may not grant table access automatically, and explicit grants also back up the policies if one is ever wrong.
- Internal functions (`record_session`, trigger functions, the hook) set `search_path = ''` and use schema-qualified names. Revoke `execute` on them from `public`, `anon` and `authenticated`, granting it only to `service_role` or `supabase_auth_admin`, because functions in exposed schemas are otherwise callable through the API.
- The unique `(user_id, week_start)` key makes the weekly coach job safe to rerun; `client_id` makes session uploads safe to retry.
- **Profile edits (D33):** when injured areas, their choices (D46) or days per week change, the app calls `generate-plan` again. It saves a new plan version (source `rules`); exercises that stay keep their targets, and new ones start with a calibration set.

Policy pattern:

```sql
-- Read-only tables (plans, plan_items, workout_sessions, set_logs, rep_records,
-- next_targets, lighter_weeks, coach_suggestions): read own rows
alter table public.set_logs enable row level security;
create policy "read own" on public.set_logs
  for select to authenticated
  using (user_id = (select auth.uid()));

-- profiles: read, insert, update own (no delete; account deletion cascades)
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "add own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "change own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- consents: append-only
create policy "read own consents" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "add own consent" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

-- audit_events: read own
create policy "read own audit" on public.audit_events
  for select to authenticated using (actor = (select auth.uid()));

-- exercises: everyone signed in can read the catalog
create policy "read catalog" on public.exercises
  for select to authenticated using (true);

-- Every table, exercises included: real accounts must have passed MFA;
-- demo sessions are anonymous
create policy "mfa or demo" on public.set_logs
  as restrictive for all to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2'
    or (select (auth.jwt()->>'is_anonymous')::boolean) is true
  );
```

## 7. Plan engine (pure TypeScript, shared)

| Profile (first match wins)                                   | Days/week | Split                                        | Reps  | Reps in reserve | Sets per exercise |
| ------------------------------------------------------------ | --------- | -------------------------------------------- | ----- | --------------- | ----------------- |
| New lifter with areas to avoid                               | 2–3       | Full body, skipping areas trained around     | 10–12 | 4+              | 2                 |
| Areas to avoid (6 months or more)                            | 2–3       | Full body, skipping areas trained around     | 8–10  | 4+              | 2                 |
| New (under 6 months)                                         | 2–3       | Full body                                    | 8–10  | 3–4             | 2–3               |
| Experienced (2+ years), or intermediate with an intense goal | 4–6       | Upper/lower (4 days) or push/pull/legs (5–6) | 6–8   | 1–2             | 3–5               |
| Intermediate (6 months–2 years)                              | 3–4       | Upper/lower                                  | 6–8   | 2–3             | 3                 |

- 6–8 is the baseline for every exercise, main lifts included (D48); only the new-lifter and injured-area rows and light exercises differ. The tops of the rep ranges are the owner's rule (D16) and the bottoms were confirmed on Oct 15 (D36). No rep range anywhere goes above 12, and none above 10 for a tester without an injured area.
- An intense goal never moves a new lifter up a row (D15).
- Days = the user's availability, capped at the row's maximum. Availability below the row's minimum is allowed down to 2 days and uses full body.
- **Rotation:** the next workout is the one after the last recorded session's day in the rotation (full body alternates A and B).
- **Calibration pass:** the first time through each workout, the user picks a light weight they could lift for the rep range with plenty left. Targets come from those sets afterwards, so nobody tests a one-rep max.
- **Injured areas (D46):** in the rows above, "areas to avoid" means every area the tester flags. For each one, the app asks how the plan should handle it:
  - **Train around it** (the default): leave out every exercise that loads it and spend the workout on other muscle groups.
  - **Train it light:** first shows the warning in §11 (Settings → Training), which the tester must acknowledge. No doctor's note or clearance is required. Exercises that load the area then stay in the plan under the light rules below.
  - Either way, recommend checking with a doctor or physical therapist and never prescribe rehab. Testers can change their areas and choices later (D33).
- **Light exercises (D47):** an exercise qualifies when it loads a light area, isn't a main lift, doesn't use a barbell and loads no area being trained around. It gets 2 sets of 10–12 reps with 4+ in reserve whatever the row, never more than 12, and shows a "Light" badge in the session.
- **Readiness checklist (D49):** a few yes-or-no questions about heart, lung or joint conditions, chest pain, dizziness, recent injury or surgery and pregnancy. Every tester then sees this warning, made more prominent when any answer is "yes":

  > Lifting is hard on your body. If you have a heart, lung or joint condition, chest pain, dizziness, a recent injury or surgery, or you're pregnant, the safest step is to talk to a doctor first. Only start if you're certain it's safe for you, and stop right away if anything feels wrong.

  The tester taps "I understand" and onboarding continues. Nothing pauses or blocks the plan, and no doctor's approval is asked for. Only the time of the acknowledgment is stored (`readiness_ack_at`); the answers never leave the phone.

- **Weight for a target:** `w = e1RM / (1 + (r + k) / 30)`, where r is the bottom of the rep range and k the reps in reserve, rounded down to the exercise's increment and never below its minimum load.

Progression after each session ("double progression", per exercise):

1. Every working set reaches the top of the range → add one increment next session.
2. Sets land within the range → keep the weight and aim for one more rep.
3. Below the range two sessions in a row → drop about 10%, rounded down to the increment and never below the minimum load.
4. Lighter week: when half or more of the plan's exercises have had no new rep record for 3 weeks, the next week uses half the sets. At most one lighter week in any 4 weeks, counting the coach's.
5. Light exercises (D47): add an increment only when every set reaches 12 reps and none was rated hard; otherwise keep the weight and aim for one more rep. Rule 3 still applies.
6. Comfort choices (D50): a session started with "Go lighter today" leaves every target unchanged, so going easy never counts as progress or as falling behind. "Lower my targets" after a session drops the chosen exercises by one increment, never below the minimum load, and resets their below-range streak.

**Exercise catalog:** 25 loaded exercises (D35, D54) covering squat, hinge, lunge, horizontal and vertical push and pull, plus accessories (D45). Claude drafts the whole catalog, cues included, for the owner to review before day 2 (D34); the draft is `claude/exercise-catalog.md` in the project. For each exercise, record:

- the muscle groups it works, one great and at most one light, shown to testers (D51);
- the joints and areas it loads, each great or light: shoulder, elbow, wrist, neck, lower back, hip, knee, ankle, tagged conservatively (D42, D51);
- its equipment: barbell, dumbbell, machine or cable;
- its increment: 5 lb for upper-body barbell lifts, 10 lb for lower-body barbell lifts, 5 lb per hand for dumbbells (log the weight per hand), 5 lb for machines and cables (D53);
- its minimum load: 45 lb for an empty barbell, 5 lb for dumbbells, machines and cables (D53);
- whether it's a main lift (D41: back squat, bench press, deadlift, overhead press), which affects swaps and light training but not reps;
- its allowed swaps: slugs with the same movement pattern (D44);
- 2–3 short form cues in plain words, such as "Brace before you lower the bar".

Onboarding offers two equipment setups: full gym, or dumbbells only (dumbbells plus an adjustable bench). There are no bodyweight moves; machines stand in, such as the lat pulldown for pull-ups. With dumbbells only, the vertical-pull slot gets a second row variant (D43).

Tests to write before building screens:

- [ ] Every profile row produces a plan within its day, set and rep limits; no rep range goes above 12.
- [ ] A tester with no injured area and 6 months or more of experience gets 6–8 on every exercise, main lifts included; a new lifter with no injured area gets 8–10; and nobody without an injured area gets a rep range above 10 (D48).
- [ ] A new lifter with an intense goal never gets the experienced row; areas to avoid beat every other row.
- [ ] No plan contains an exercise that loads an area being trained around, including after the areas or choices change.
- [ ] When avoided areas or the equipment setup rule out every exercise in a movement pattern, the plan skips that slot (or uses D43's row) and stays valid.
- [ ] Every allowed swap names an existing exercise with the same movement pattern and never a main lift; every compound lift has at least one swap (D41, D54).
- [ ] Avoiding an area leaves out exercises that load it great or light; training it light keeps both (D51).
- [ ] A new lifter's plan never contains the deadlift (D52).
- [ ] A light exercise is never a main lift or a barbell lift, never loads an area being trained around, always has 2 sets of 10–12, and goes up in weight only when every set hit 12 reps and none felt hard.
- [ ] "Train it light" can't be saved until the warning has been acknowledged (`light_ack_at`).
- [ ] No readiness answer stops a plan from being built once the warning is acknowledged (D49).
- [ ] A "Go lighter today" session leaves targets unchanged; "Lower my targets" drops one increment at most and never below the minimum load (D50).
- [ ] Progression never raises a weight by more than one increment per session.
- [ ] Property tests (fast-check): random profiles and logs never produce a weight that is negative, below the exercise's minimum load or not a multiple of its increment.
- [ ] Lighter weeks never land fewer than 4 weeks apart.

## 8. Workout session

1. **Start:** Today tab → Start first asks "How are you feeling today?" (Good, A bit off, Sore or hurting). Anything but Good offers "Go lighter today", which takes one increment off every target for this session only, never below the minimum load (D50). Then it creates a session on the phone with a `client_id`, the workout's day label and `started_at`. One session at a time.
2. **Timer:** a large ring shows sets done out of sets planned, with the time since `started_at` in its center. The time is recomputed from the clock every second, so it stays correct after backgrounding or a restart.
3. **Logging:** each exercise card shows its muscle-group labels (e.g. "Legs · great Back · light", D51), target weight, rep range, reps in reserve and form cues, plus a small ring for its sets. +/− steppers set weight (by the increment) and reps, a round "Log set" button records the set with an effort choice (easy, OK, hard), and a "New rep record" badge appears when a set beats the cached record at that weight. Light exercises (D47) also show a "Light" badge and a "Pain? Stop" button, which ends that exercise, keeps the sets already logged, and offers to switch the area to "Train around it" (a plan rebuild). Nothing about the pain is stored.
   - **Every exercise card** also has "Pain? Stop" (D50). It ends that exercise, keeps the sets already logged, and asks whether to flag an injured area (Settings → Training).
   - **After a set rated hard, or below the bottom of the rep range,** the app asks: "That looked tough. Lower the weight for your next set?" with "Lower it" (one increment down, never below the minimum load) and "Keep it".
4. **Saving:** the session is written to app storage after every set, so a killed app resumes where it left off. Discarding asks for confirmation.
5. **Finish:** asks "How did that feel?" (Comfortable, Too hard, Something hurt). "Too hard" offers "Lower my targets" for the exercises the tester picks. "Something hurt" offers to flag an injured area, and the next time the app opens it asks "How's it feeling since your last workout?" with the same options. Then it shows a summary and calls `finish-workout` with the whole session. If the phone is offline or the call fails, the app says "Saved on this phone" and offers a Retry button that resends it with the same `client_id`, so nothing is duplicated. Automatic retry comes after Nov 6.
6. **On the server,** `finish-workout`:
   - checks the caller is `aal2` or anonymous;
   - validates the payload: the phone's UTC offset (D66), known exercises, at most 12 exercises with 10 sets each, start before end, end no later than 5 minutes from now, under 6 hours long;
   - calls `record_session`, which writes the session and its sets in one transaction, after which the trigger updates rep records;
   - runs progression from `_shared/rules`, applying "Go lighter today" (`went_lighter`, targets unchanged) and "Lower my targets" (the listed exercises, one increment down), writes `next_targets` and any lighter week, and logs `session_recorded`. The comfort answers themselves never leave the phone.
7. After the calibration pass, each exercise's targets come from its estimated max (§7).

**Look and motion (D38):**

- Dark-first theme with one bold accent color and heavy type; the Hangul wordmark 새봄 appears on the sign-in screen and the icon, and all other text is in English.
- Rings are drawn with `react-native-svg`; motion uses `react-native-reanimated`. Both are in Expo's SDK; add them with `npx expo install`.
- Transitions stay short (about 300 ms or less). With iOS Reduce Motion on, they become fades.
- Rings show sets and sessions in Saebom's own colors and never as three nested rings, so nothing resembles Apple's Activity rings (guideline 5.2.5).
- Accessibility: VoiceOver labels on every ring and button, Dynamic Type for text, and contrast checked in both themes.

Deferred: a rest timer between sets.

## 9. Reminders

- **Permission** is requested only after the user taps "Turn on reminders"; the app works fully without it.
- **Settings** (kept on the phone only): the weekdays and the time.
- **Scheduling:** whenever the app opens, a session finishes or settings change, cancel this app's scheduled notifications and schedule one-off notifications for the next 28 days. iOS keeps only about the 64 soonest local notifications, and this stays under that.
- **Clearing:** signing out, deleting the account or turning reminders off cancels all of them.

| When                                                                   | Text                                    |
| ---------------------------------------------------------------------- | --------------------------------------- |
| A chosen weekday at the chosen time, if today's workout isn't recorded | Time for today's workout                |
| Saturday 10:00, if this week is behind plan                            | There's still time for this week's plan |
| Monday 8:00, if the AI coach is on                                     | Your weekly check-in is ready           |

Never in a notification: weights, reps, records, injured areas or any other health data.

## 10. AI coach (opt-in)

1. **Who:** users whose latest `ai_coach` consent is granted, who aren't anonymous and who have at least 2 weeks of sessions.
2. **When:** Supabase Cron calls `coach-review` on Sundays at 22:00 UTC. The function works through users one by one, stops at the daily cap in `ai_usage`, and skips anyone who already has a row for this `week_start` (the ISO Monday, UTC).
3. **Summary (anonymous):** for each exercise slug, the weekly estimated max for 4 weeks, the best set each week, the current target and rep range and the below-range streak. It also includes sessions done and planned each week, days used and available, the row's limits, and each exercise's allowed swaps, already filtered by equipment and avoided areas. Light exercises (D47) are left out of the summary, and the checker rejects any change that names one. The areas themselves are never sent, and neither are user IDs, names, emails, ages, dates or free text.
4. **Ask:** call the Workers AI REST API with JSON Mode (request below).
5. **Check:** validate the reply against the schema, then each change against the limits below and the current plan. Drop anything that fails and record why in `checker_log`.
6. **Show:** cards on the Coach tab with the one-line reason. Pending suggestions expire after 7 days.
7. **Decide:** `accept-suggestion` re-checks the change against the current plan, since targets may have moved, then writes a new plan version (source `coach`) and updates targets. Dismiss records the choice. Both write audit events.
8. **Fall back:** on any failure (quota spent, timeout, or JSON Mode's "couldn't be met" error), skip that user this week; progression keeps running.

| Change                   | Limit the checker enforces                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `change_weight`          | Within 10% of the current target per week, a multiple of the increment, not below the minimum load              |
| `change_reps`            | Inside the row's rep range caps (§7), with min below max                                                        |
| `swap_exercise`          | Replacement from that exercise's allowed list, with the same movement pattern                                   |
| `add_set` / `remove_set` | Each exercise stays within the row's sets range; the weekly total stays within 20% of the rules-built plan      |
| `add_day`                | Total days stay at or below both the user's availability and the row's maximum; the rules engine builds the day |
| `lighter_week`           | At most one in any 4 weeks, rules-triggered ones included                                                       |

Request (the token needs only the Workers AI Read and Workers AI Edit permissions):

```http
POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast
Authorization: Bearer {WORKERS_AI_TOKEN}
Content-Type: application/json

{
  "messages": [
    {"role": "system", "content": "You review a lifter's last 4 weeks of training. Propose at most 3 changes, only from the allowed kinds and only for exercise slugs in the summary. If progress is on track, return an empty list."},
    {"role": "user", "content": "<anonymous JSON summary>"}
  ],
  "response_format": {"type": "json_schema", "json_schema": <the schema below>}
}
```

Schema:

```json
{
  "type": "object",
  "required": ["changes"],
  "properties": {
    "changes": {
      "type": "array",
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": ["kind", "reason"],
        "properties": {
          "kind": {
            "enum": [
              "change_weight",
              "change_reps",
              "swap_exercise",
              "add_set",
              "remove_set",
              "add_day",
              "lighter_week"
            ]
          },
          "exercise": { "type": "string" },
          "replacement": { "type": "string" },
          "new_weight_lb": { "type": "number" },
          "rep_min": { "type": "integer" },
          "rep_max": { "type": "integer" },
          "reason": { "type": "string", "maxLength": 140 }
        }
      }
    }
  }
}
```

Fields by kind: `exercise` for every kind except `add_day` and `lighter_week`; `new_weight_lb` for `change_weight`; `rep_min` and `rep_max` for `change_reps`; `replacement` for `swap_exercise`. The checker rejects missing or extra fields. JSON Mode may not enforce every schema keyword, so the checker re-validates everything.

Treat the model's output as untrusted input: the checker is the security boundary, and no user-written text ever enters the prompt. Cloudflare states it doesn't use Workers AI inputs or outputs to train models or improve its services without consent. The consent screen names Cloudflare as the AI provider.

## 11. Accounts, consent and privacy

### Invite-only accounts, no email service

1. The owner runs `npm run invite -- friend@example.com` on the Mac. The script reads the secret key from `scripts/.env.local` and:
   - adds the email to `invites`;
   - creates the user with the email marked as confirmed;
   - gets a one-time sign-in code from the admin API's generate-link call, which sends no email;
   - prints the code and writes an audit event.
2. The owner sends the code privately. Apple's TestFlight invitation goes to the same person.
3. In the app: "I have an invite code" → email and code → set a password of 12+ characters → enroll an authenticator app → enter a code from it → MFA verified. For enrollment, a button opens the `otpauth://` link in an authenticator app, and the secret is shown to copy.
4. Consent (below) → 18+ confirmation → readiness checklist and warning (D49) → onboarding → plan.

Later sign-ins use email, password and an authenticator code. Face ID only unlocks a session that already exists; it isn't a sign-in factor.

- **Password reset:** the owner runs `npm run invite -- --reset friend@example.com` for a new one-time code; the user signs in with it, passes MFA and sets a new password in Settings.
- **Lost authenticator:** the owner removes the factor with the admin API, following `docs/emergency-access.md`, and the user enrolls again. Logged.
- **Auth settings (day 3):** anonymous sign-ins on, manual linking off, TOTP MFA on, minimum password length 12, Before User Created hook on, email code expiry long enough for invites (up to 24 hours).

Before User Created hook (check the exact return shape against Supabase's hook docs on day 3):

```sql
create or replace function public.hook_invite_only(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  -- demo mode
  if coalesce((event->'user'->>'is_anonymous')::boolean, false) then
    return '{}'::jsonb;
  end if;
  -- invited by the owner's script
  if exists (select 1 from public.invites i
             where i.email = lower(event->'user'->>'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'This app is invite-only.'));
end;
$$;

grant execute on function public.hook_invite_only(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_invite_only(jsonb) from public, anon, authenticated;
grant select on public.invites to supabase_auth_admin;
create policy "auth admin reads invites" on public.invites
  for select to supabase_auth_admin using (true);
```

### Consent (D14)

- Shown after MFA and before any workout or health information is collected. The full privacy policy (`docs/privacy-policy.md`, bundled in the app and versioned) is one tap away.
- Two separate choices:
  1. **Required:** "Store my workouts, my plan and the health information I enter (injured areas and how I train them, when I acknowledged the readiness warning) to run the app." Declining explains the app can't work without it and offers to delete the account.
  2. **Optional, off by default:** "Once a week, send an anonymous summary of my training to Cloudflare Workers AI for coach suggestions."
- Each choice becomes a `consents` row with the policy version and time. A new policy version asks again before the app continues.
- Settings → Privacy has the AI coach switch (each change adds a row) and "Withdraw consent and delete my data", which runs account deletion. A screen listing the consent history comes after Nov 6; the ledger itself is kept from day 1.
- iOS asks separately for notifications and Face ID.

### Settings → Training (D33)

- Injured areas, their choices and days per week can be changed at any time. Saving explains that the plan will be rebuilt, then calls `generate-plan` for a new version (§6).
- Flagging an area, here or in onboarding, asks how the plan should handle it (D46). "Train around it" is preselected: "Your plan leaves out exercises that load this area and works your other muscle groups." "Train it light": "Lighter weights and more reps on this area." Choosing light first shows this warning on its own screen, in large plain text with nothing else to read:

  > Training an injured area can make it worse. Only choose this if you're certain it's safe for you. A doctor or physical therapist is the surest way to know. This isn't rehab: stop right away if anything hurts.

  The buttons are "I understand, train it light" and "Train around it instead". Only the first saves the choice, and it records `light_ack_at`. The warning appears each time an area is switched to light, and no doctor's note or clearance is asked for.

- A new injured area also repeats the advice to check with a doctor or physical therapist.

### Privacy features

- [ ] The consent ledger above.
- [ ] **Export my data:** `export-data` returns all of the user's rows as JSON; the app hands it to the iOS share sheet and deletes its temporary file afterwards. Logged.
- [ ] **Delete my account** (in the app, as Apple 5.1.1(v) requires): `delete-account` logs the event, then deletes the user (all rows cascade) and the invite. The app cancels reminders, clears the Keychain and storage, and returns to sign-in.
- [ ] Data minimization (D25).
- [ ] Retention, stated in the privacy policy: audit events 1 year, backups 14 days, demo users 24 hours.
- [ ] Only the owner can reach production data (D29). Owner actions go through scripts that write audit events; browsing tester data in the Supabase dashboard is avoided.
- [ ] A public copy of the privacy policy, needed for the public launch (§18); the in-app copy is enough for now.

### Demo mode

- "Try the demo" on the sign-in screen → anonymous sign-in → `seed-demo`, which refuses any caller that isn't anonymous, copies a synthetic lifter into the session: 8 weeks of history, a pending coach suggestion and one change the checker dropped. v1 has one synthetic lifter; two more come after Nov 6. The full app then runs with a "Demo — sample data" banner. Demo sessions skip consent and onboarding, since they hold only synthetic data, and trigger no AI calls.
- Supabase limits anonymous sign-ins to 30 an hour per IP address by default; add a CAPTCHA only if the demo is abused.
- TestFlight App Review uses demo mode, explained in the review notes, plus a review account with its authenticator secret in case Apple asks for a login.

Nightly cleanup (Supabase Cron, SQL):

```sql
-- pending coach suggestions expire after 7 days
update public.coach_suggestions
set status = 'expired'
where status = 'pending' and created_at < now() - interval '7 days';

-- audit events are kept for 1 year
delete from public.audit_events
where created_at < now() - interval '1 year';

-- demo users and their audit rows go after 24 hours
delete from public.audit_events a
using auth.users u
where a.actor = u.id
  and u.is_anonymous is true
  and u.created_at < now() - interval '24 hours';

delete from auth.users
where is_anonymous is true
  and created_at < now() - interval '24 hours';
```

## 12. Security

### Which rules apply

- **Who the beta covers:** adults in the US outside Washington State (D30). Children's privacy law, GDPR and Washington's health data law aren't expected to reach the beta. The design follows them anyway, because a public launch can reach those users (§18).
- **HIPAA** doesn't cover this app: the owner isn't a covered entity or business associate. Its technical safeguards (45 CFR 164.312) are the checklist anyway.
- **FTC Health Breach Notification Rule:** with real tester data, a breach of identifying health data means notifying the affected users, the FTC and sometimes the media. Penalties are per violation and adjusted for inflation each year. `docs/incident-response.md` says who does what.
- **Washington's My Health My Data Act:** consent before collecting or sharing consumer health data, a consumer health data privacy policy, and deletion on request. It applies once Washington residents use the app; the consent design above is built to meet it.
- **Apple's guidelines:** a privacy policy, consent with an easy way to withdraw it, and in-app account deletion (5.1.1); explicit permission before sharing data with a third-party AI (5.1.2); no health data for advertising or marketing (5.1.3); no sensitive information in notifications (4.5.4); no look-alikes of the Activity rings (5.2.5); full access for reviewers (2.1); betas belong on TestFlight (2.2).
- **HIPAA changes ahead:** HHS proposed on Dec 27, 2024 to require MFA and encryption at rest and in transit; as of Oct 8, 2026 it was still a proposal.
- None of this is legal advice. Before the public launch, a short review by a privacy lawyer is worth it if the budget allows.

### HIPAA technical safeguards mapping

| Safeguard (45 CFR 164.312)      | How the app meets it                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unique user identification      | One Supabase Auth user per invited person; RLS ties every row to it                                                                                                        |
| Emergency access procedure      | `docs/emergency-access.md`: owner-run export, restore and MFA reset, each logged                                                                                           |
| Automatic logoff                | Face ID or passcode lock after 15 minutes idle or in the background; signing out revokes the refresh token                                                                 |
| Encryption and decryption       | Supabase encrypts data at rest (AES-256) and in transit (TLS); the session token sits in the iOS Keychain (this device only); backups are encrypted with age before upload |
| Audit controls                  | Append-only `audit_events`: sign-ins, consent changes, sessions, plan versions, coach decisions, exports, deletions and owner actions                                      |
| Integrity                       | Functions are the only writers of training data; plans are versioned; check constraints; idempotent uploads                                                                |
| Person or entity authentication | Password plus authenticator-app MFA, enforced by RLS                                                                                                                       |
| Transmission security           | HTTPS only (iOS App Transport Security); reminders are local, so nothing passes through a push service                                                                     |

### Threat model (STRIDE)

| Threat                 | Example                                                                               | Mitigation                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | A stolen password, a stolen unlocked phone or a leaked invite code                    | MFA enforced by RLS; the app lock; one-time codes tied to one email that expire                                                                          |
| Tampering              | Forged sets or plans sent to the API                                                  | Training tables are read-only to the app (policies and grants); functions validate input; internal SQL functions can't be called by app roles            |
| Repudiation            | "I never accepted that change"                                                        | Audit events for every accept, dismissal, consent change and plan version                                                                                |
| Information disclosure | A lock screen, the AI provider, a lost phone, public CI logs or backups               | Generic notification text; opt-in anonymous summaries; Keychain (this device only) plus the app lock; nothing sensitive printed in CI; encrypted backups |
| Denial of service      | Demo sign-up spam, a burned AI quota, or cron endpoints called by strangers           | IP rate limit and nightly cleanup; weekly cron and a daily cap; cron functions require a secret key                                                      |
| Elevation of privilege | Prompt injection, a demo user becoming a real account, or a sign-up without an invite | No user text in prompts, the checker and user approval; manual linking off; the invite hook                                                              |

### OWASP Mobile Top 10 (2024)

| Risk                                     | How the app handles it                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| M1 Improper Credential Usage             | Only the publishable key ships in the app                                                   |
| M2 Inadequate Supply Chain Security      | Lockfile, Dependabot, few dependencies, Expo SDK modules                                    |
| M3 Insecure Authentication/Authorization | MFA and RLS; functions check `aal` and `is_anonymous`                                       |
| M4 Insufficient Input/Output Validation  | Function payload checks, check constraints, the coach checker                               |
| M5 Insecure Communication                | HTTPS only                                                                                  |
| M6 Inadequate Privacy Controls           | Consent ledger, data minimization, export and deletion                                      |
| M7 Insufficient Binary Protections       | Accepted risk: the binary holds no secrets                                                  |
| M8 Security Misconfiguration             | The checks in §15: RLS everywhere, the hook, manual linking off                             |
| M9 Insecure Data Storage                 | Keychain for tokens; only the in-progress session is on disk, and it's deleted after upload |
| M10 Insufficient Cryptography            | Platform cryptography only (TLS, Keychain, Supabase); age for backups                       |

### Function security

- **User-facing functions** keep JWT verification on and use the wrapper from Supabase's "Securing Edge Functions" guide (`withSupabase({ auth: 'user' })`), which gives a client limited by the caller's RLS. They reject callers that are neither `aal2` nor anonymous, and use the secret key only for writes RLS forbids.
- **`coach-review`** is called by cron with a dedicated named secret key, `cron`, read from Vault and sent in the `apikey` header. It's deployed with JWT verification off and accepts only that key (`withSupabase({ auth: 'secret:cron' })`). Supabase's scheduling example sends the publishable key, which anyone can read from the app, so don't copy that part.

Weekly schedule. Run the two `vault.create_secret` lines once in the SQL editor, never in a migration, because migrations are committed to the public repo:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<the cron secret key>', 'cron_key');

select cron.schedule('coach-review-weekly', '0 22 * * 0', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/coach-review',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
$$);
```

### Secrets

| Secret                                      | Lives in                                                         | Never in        |
| ------------------------------------------- | ---------------------------------------------------------------- | --------------- |
| Supabase publishable key                    | App config; public by design, RLS protects the data              | —               |
| Supabase secret key                         | Edge Function environment                                        | App, repo       |
| Named secret key `cron`                     | Supabase Vault, for pg_cron                                      | App, repo       |
| Secret key for the invite script            | `scripts/.env.local` on the owner's Mac (git-ignored)            | Repo, CI        |
| Workers AI token, scoped to Workers AI      | Supabase secrets                                                 | App, repo       |
| Workers AI token for local testing          | `supabase/functions/.env.local` on the owner's Mac (git-ignored) | Repo, CI        |
| Supabase access token and database password | GitHub Actions secrets                                           | Repo            |
| Backup project's secret key                 | GitHub Actions secrets                                           | Repo            |
| age private key, for restores               | The owner's password manager                                     | Anywhere online |
| Apple signing                               | Xcode on the owner's Mac                                         | Repo            |

The age public key can live in the repo.

### Backups and keep-alive (`backup.yml`, nightly)

1. Dump the main project's schema and data over the Session pooler connection string (GitHub's runners have no IPv6), using `supabase db dump` or a `pg_dump` at least as new as the server.
2. Encrypt with `age -r <public key>`, upload to a private Storage bucket in the second project, and delete dumps older than 14 days.
3. Call the main project's API once to keep it active.
4. Never print data or connection strings: use `set -euo pipefail` and never `set -x`. The repo is public, so its Actions logs are too.
5. Before inviting testers, run a restore drill: decrypt a dump, load it into the local stack and run the pgTAP tests.

## 13. iOS build and TestFlight

### Before Oct 26 (outside the 40 hours, about 3 hours)

- [x] Enroll in the Apple Developer Program as an individual ($99; confirm the final charge at checkout). Identity checks can take time, so do this first. **Approved Oct 23.**
- [x] Create the app record in App Store Connect to reserve the name Saebom (D37). **Done Oct 24:** bundle ID `com.rrim.saebom` registered, record created, agreements accepted.
- [x] Install Xcode with an iOS Simulator runtime, Node 24, Deno 2, Docker Desktop and Git. The Supabase CLI needs no global install: it's pinned in the root `package.json` and runs as `npx supabase` (see `CLAUDE.md`, Commands). Put an authenticator app on the iPhone.
- [x] Create accounts: GitHub; Supabase, with two projects, `saebom` and `saebom-backups`, in the US region closest to you; Cloudflare for Workers AI; Expo.
- [x] Review Claude's draft exercise catalog and form cues (D34), in the project as `claude/exercise-catalog.md`. **Done Oct 25:** the six questions answered (D41, D51–D54) and the read-through finished.
- [x] Prepare the Mac and iPhone: Xcode license and account, the iPhone paired with Developer Mode on, Docker running, Node 24 and Deno 2. **Done Oct 24.**
- [x] Ahead of day 1: the bare Expo app created in `app/`, run in the Simulator and on the iPhone, archived, uploaded to TestFlight and installed. **Done Oct 24.**
- [ ] Optional warm-ups: Expo's "Get started" tutorial on the iPhone (about an hour) and Supabase's row-level security guide (about an hour).

### Day-to-day setup

- The project lives at `~/Development/saebom` (D55). Run app commands from `~/Development/saebom/app`.
- Agent sessions: `docs/agent-workflow.md` covers the one-time setup (pstack, Antigravity CLI, the env files) and the loop for each task (D58–D65).
- Build in the iOS Simulator against the local Supabase stack; test on the iPhone with a development build against the hosted project.
- `app.json` needs:
  - the bundle identifier `com.rrim.saebom`, the display name "Saebom", the version and build number (raise `ios.buildNumber` before every upload; build 1 went up on Oct 24, so the next is 2);
  - `ios.appleTeamId`, so signing survives every `prebuild` without touching Xcode;
  - the `./plugins/withNoScriptSandbox` entry in `plugins` (D56);
  - the Face ID usage text (`NSFaceIDUsageDescription`);
  - privacy manifest entries (see Expo's privacy manifest guide);
  - `ITSAppUsesNonExemptEncryption` set to false, since the app only uses iOS's own HTTPS and Keychain.
- The icon: the 새봄 wordmark or a single bold circle in the accent color, legible at small sizes.
- Build for TestFlight on the Mac with an Xcode archive (proven Oct 24), or `eas build --local` followed by `eas submit`. Expo's cloud builds are the fallback.

### Uploading a build (the path proven on Oct 24)

1. Raise `ios.buildNumber` in `app.json`, then run `npx expo prebuild -p ios` from `app/`.
2. `open ios/Saebom.xcworkspace` (the workspace, not the `.xcodeproj`). Check Signing & Capabilities shows the (Individual) team with automatic signing.
3. Choose **Any iOS Device (arm64)**, then **Product → Archive**.
4. In the Organizer: **Distribute App → App Store Connect** (not "TestFlight Internal Only" or "Release Testing") → Distribute.
5. In App Store Connect → Saebom → TestFlight, wait for processing, add the build to the internal group, and install it from the TestFlight app.

### Troubleshooting (found during setup, Oct 24)

| Symptom                                                                                                            | Cause                                                                   | Fix                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build fails at "[CP] Copy Pods Resources" with `Sandbox: bash deny file-write-create`                              | Xcode's User Script Sandboxing blocks the CocoaPods script              | Already fixed by `app/plugins/withNoScriptSandbox.js` (D56); if it returns, check the plugin is still listed in `app.json` and run `npx expo prebuild -p ios --clean` |
| The app shows `ConfigError: The expected package.json path … does not exist`, or Expo prints "Skipping dev server" | An old Metro server, started from another folder, still holds port 8081 | `lsof -nP -iTCP:8081 -sTCP:LISTEN`, then `kill <PID>`, then run the command again from `~/Development/saebom/app`                                                     |
| Xcode builds fail with missing modules                                                                             | The `.xcodeproj` was opened instead of the workspace                    | `open ios/Saebom.xcworkspace` from `app/`                                                                                                                             |
| "App Record Creation Error: … already used" during Distribute                                                      | The record already exists; Xcode tried to create it again               | Reopen the Organizer and distribute again; or export the `.ipa` and upload with Apple's Transporter app                                                               |
| "Upload Symbols Failed … did not include a dSYM" for React, Hermes, ExpoImage or SDWebImage                        | Those frameworks ship pre-compiled without symbols                      | Harmless; the upload still goes through. Uncheck "Upload your app's symbols" if it ever blocks an upload                                                              |
| Upload rejected for a used build number                                                                            | Every upload needs a higher `ios.buildNumber`                           | Raise it in `app.json`, run `npx expo prebuild -p ios`, archive again                                                                                                 |
| Anything odd after moving the folder                                                                               | Absolute paths in `ios/` and a stale Metro                              | Stop Metro (above), then `npx expo prebuild -p ios --clean`                                                                                                           |

### TestFlight

- **Internal group:** the owner. Internal testers must be App Store Connect team members with a role, which also gives them access to App Store Connect, so friends and family go in the external group instead.
- **External group "Friends & family":** email invites only, no public link. The first build needs TestFlight App Review. Fill in the beta app description, the feedback email (the owner's), a review contact, and sign-in information (demo mode plus the review account).
- **Expiry:** builds expire after 90 days; upload a fresh one before then.
- **Roster:** testers and `invites` are the same people; remove someone from both when they leave.

Review notes template:

> Saebom is an invite-only beta for friends and family. To explore every feature with sample data, tap "Try the demo" on the sign-in screen; no account is needed. A review account is also provided, with its authenticator secret below. Reminders are local notifications. The AI coach is opt-in and sends only an anonymous training summary.

## 14. Build schedule and status

All items are open; build work hadn't started by Oct 28, the date of day 3. Days 1–5 run Mon Oct 26 – Fri Oct 30; days 6–10 run Mon Nov 2 – Fri Nov 6. From v2.11, agents work through these items one task and one pull request at a time (D58, D62): the next task is the first unchecked item, the pull request that finishes an item ticks it, and the owner reviews and merges each one. The work added in v2.4–v2.8 fits into these ten days, with no days added (v2.9): day 2 takes the new plan rules, and day 7 takes the after-session check-ins and Settings → Training from days 5 and 8. Days 5 and 6 are still the fullest. If a day runs over, cut from the "If behind" list below, never tests.

**Day 1 · Mon, Oct 26 · Foundations**

- [x] Link `~/Development/saebom` to `rryan1010/saebom` (D57): remove the nested `app/.git` that `create-expo-app` may have made, make sure `app/.gitignore` ignores `/ios`, pull `main` (GitHub's README and LICENSE, plus `CLAUDE.md`, this handoff and the agent setup from the agent-workflow pull request), and push the first commit.
- [x] The rest of the §5 layout, including the npm scripts `CLAUDE.md` lists (`CLAUDE.md` and `docs/HANDOFF.md` arrive with the agent-workflow pull request). **App config done Oct 30** (routes in `app/app/`, the tsconfigs, ESLint with Prettier, Metro, EAS, `.env.example`); `docs/emergency-access.md` and `docs/incident-response.md` done Oct 30.
- [x] An Expo app (TypeScript, Expo Router) running in the Simulator and on the iPhone. **Done Oct 24.**
- [x] The dark-first theme tokens. The accent color is a default until the owner answers #7.
- [x] `supabase init` and `supabase start`; the first migration: all tables, RLS policies and grants (§6), and the `e1rm_by_week` view.
- [x] pgTAP tests: user B can't read user A's rows; a session that skipped MFA reads nothing; the app can't write training tables.
- [ ] CI: `npm run verify` on every push; `CLAUDE.md` lists every check it runs.
- [ ] A GitHub ruleset on `main`: pull request and passing CI required, no force-pushes. It's also the server-side backstop for the agents' guard (D65). Rulesets need a public repo on GitHub Free, so make the repo public first (D57).
- [x] Owner: archive the bare Expo app, upload it to TestFlight for internal testing only, and install it on the iPhone. **Done Oct 24,** ahead of day 1; signing and upload are proven.

**Day 2 · Tue, Oct 27 · Plan engine**

- [ ] `_shared/rules`: profile rows and precedence (6–8 baseline, 8–10 for new lifters, D48), splits, exercise filters (avoided areas great or light, D51; no deadlift for new lifters, D52), light exercises (D47), the weight formula, progression with the comfort choices (D50) and lighter weeks.
- [ ] The unit and property tests from §7.
- [ ] The exercise catalog seed from the reviewed draft: 25 exercises with graded labels, swaps and cues (§7, D51–D54).
- [ ] The rep-record trigger and `record_session`, with `execute` revoked from app roles.
- [ ] Spike: the app imports `_shared/rules` through Metro.

**Day 3 · Wed, Oct 28 · Accounts**

- [ ] Hosted project: link it, push migrations, apply the auth settings and the Before User Created hook (§11).
- [ ] `scripts/invite.ts`, with invite and reset.
- [ ] The Supabase client with a Keychain storage adapter (split into chunks, this device only) and the AppState refresh listener.
- [ ] Screens: invite-code sign-in, set password, MFA enrollment and challenge, password sign-in.
- [ ] Check: an email that wasn't invited can't sign up, and anonymous sign-in still works.

**Day 4 · Thu, Oct 29 · Consent, onboarding, first plan**

- [ ] The consent screen with both choices, writing to `consents`; the 18+ confirmation.
- [ ] The readiness checklist and its warning (answers stay on the phone, nothing blocks, D49) and the onboarding form, writing to `profiles`, including the train-around or train-light choice for each injured area (D46).
- [ ] `generate-plan`, the first Edge Function, saving plan version 1 with the calibration pass; it also handles rebuilds (§6).
- [ ] Today tab: the next workout in the rotation, with Start.

**Day 5 · Fri, Oct 30 · Workout session**

- [ ] The session screen: the timer ring, exercise cards with muscle-group labels (D51), cues and set rings, the round Log set button, effort and the record badge, saved after every set; the Light badge for light exercises (D47); "Pain? Stop" on every card, the before-session check-in with "Go lighter today", and the nudge after a hard set (D50).
- [ ] `finish-workout`: validation, `record_session`, progression (including `went_lighter`), `next_targets` and the audit event.
- [ ] Unsent sessions: "Saved on this phone" and a Retry button with the same `client_id`.
- [ ] Milestone: a calibration pass logged on the iPhone, with next targets showing.

**Day 6 · Mon, Nov 2 · Progress, reminders, app lock**

- [ ] Progress tab: this week's sessions ring, rep records and each lift's best estimated max.
- [ ] Local reminders (§9).
- [ ] The app lock (D23); signing out cancels reminders and clears the Keychain.
- [ ] Screen transitions and card animations, with Reduce Motion respected.

**Day 7 · Tue, Nov 3 · AI coach, part 1**

- [ ] A Workers AI token limited to Workers AI, stored as a Supabase secret.
- [ ] `_shared/coach`: the summary builder and the checker, with a test for every limit.
- [ ] `coach-review`: the consent check, the JSON Mode call, the daily cap and `checker_log`; the weekly cron with the `cron` key from Vault.
- [ ] Moved from day 5: the after-session check-in ("How did that feel?"), "Lower my targets" in `finish-workout`, and the next-open follow-up after "Something hurt" (D50).
- [ ] Moved from day 8: Settings → Training (injured areas, their choice of avoid completely or decreased intensity with its warning, days per week, rebuilding the plan), reusing day 4's onboarding screens.

**Day 8 · Wed, Nov 4 · AI coach, part 2, audit, settings**

- [ ] Coach tab cards; `accept-suggestion` (re-check, new plan version, targets); dismissal.
- [ ] Audit events: sign-ins (a trigger on new auth sessions if Supabase allows one there, otherwise logged from functions), consent changes, sessions, plan versions, coach decisions and owner script actions.
- [ ] Settings: the AI coach switch and "Withdraw consent and delete my data" (Training moved to day 7).

**Day 9 · Thu, Nov 5 · Privacy, demo, hardening**

- [ ] `export-data` with the share sheet; `delete-account`; the privacy policy screen.
- [ ] Demo mode: anonymous sign-in, `seed-demo` with one synthetic lifter, and the nightly cleanup.
- [ ] `backup.yml` with the keep-alive call; one restore drill.
- [ ] `deploy.yml` (on main: `supabase db push` and `supabase functions deploy`; until then, run both from the Mac); Dependabot, CodeQL and secret scanning with push protection; the OWASP Mobile Top 10 pass (§12).

**Day 10 · Fri, Nov 6 · TestFlight**

- [ ] App icon, name and the `app.json` settings (§13).
- [ ] Archive, upload, and install from TestFlight on the iPhone, repeating §13's upload steps with the next build number.
- [ ] App Store Connect: test information, review notes and sign-in information; the external group; submit for TestFlight App Review.
- [ ] A lean README (pitch, architecture, how to run and test) that links `docs/threat-model.md` and `docs/hipaa-mapping.md`, both adapted from §12.

**If behind, cut in this order:** the weekly nudge → animations beyond the default transitions → automated backups (dump by hand weekly) → demo mode (keep only the review account, though Apple may struggle with its authenticator code) → the progress rings (plain numbers instead).

**After Nov 6:** invite testers once the beta review passes; record the 3-minute demo video; then the trend line chart, the consent-history screen, automatic upload retry, two more demo lifters, the rest timer, kilograms, the rest of the profile editor and "Ask the coach"; then the public-launch checklist (§18).

## 15. Before inviting testers

- [ ] `select tablename from pg_tables where schemaname = 'public' and not rowsecurity;` returns no rows.
- [ ] pgTAP: a session that skipped MFA reads nothing; user B sees none of user A's rows; app roles can't insert into training tables or call internal functions.
- [ ] An email that wasn't invited can't sign up; anonymous sign-in works; manual linking is off.
- [ ] The app's JavaScript bundle contains no secret key or token.
- [ ] With the Workers AI token revoked, the app still runs and progression still updates.
- [ ] Reminders fire at the chosen time, skip a day with a recorded workout and stop after sign-out.
- [ ] The app locks after 15 minutes; Face ID and the passcode both unlock it.
- [ ] Adding an area to train around rebuilds the plan without any exercise that loads it.
- [ ] A tester who answers "yes" on the readiness checklist still gets a plan after acknowledging the warning (D49).
- [ ] The comfort check-ins appear before and after a session and after a hard set, and "Go lighter today" and "Lower my targets" behave as §7 says (D50).
- [ ] "Train it light" can't be chosen without acknowledging the warning, gives that area only light exercises (2 × 10–12, no main lifts or barbells), and "Pain? Stop" switches it to "Train around it".
- [ ] Export and deletion work: deletion removes every row and the invite, and only audit events remain, with no health values, for the retention period the privacy policy states.
- [ ] With the AI coach switched off, that user gets no review the next Sunday.
- [ ] VoiceOver reads every ring and button; Reduce Motion turns transitions into fades.
- [ ] Demo mode works, and the nightly cleanup has run at least once.
- [ ] A backup has run and a restore drill passed.
- [ ] The Supabase project is awake.

## 16. Open questions and risks

- **Invite codes without email:** confirm on day 3 that the admin generate-link call returns a usable one-time code without custom SMTP; Supabase's notice about its email changes says generate-link works without it. Fallback: a temporary password the user must change at first sign-in.
- **The hook and script-created users:** the invite script adds the email to `invites` before creating the user, so the hook passes either way.
- **Keychain size:** a Supabase session can be larger than SecureStore comfortably holds, so the adapter splits it into chunks; test with a real session on day 3. iOS keeps Keychain items after an app is deleted, so clear stale ones on first launch.
- **Metro and `_shared/`:** spike on day 2; the copy script is the fallback.
- **Sign-in audit trigger** on Supabase's auth tables: confirm on day 8.
- **JSON Mode reliability:** if the 70B model often fails the schema, simplify the schema or switch to `@cf/meta/llama-3.1-8b-instruct`.
- **TestFlight review with MFA:** if reviewers can't use demo mode, the review account's authenticator secret goes in the notes.
- **The name:** resolved Oct 24. The App Store Connect record "Saebom" exists (D37).
- **Signing and upload:** resolved Oct 24. A bare build went through archive, upload, processing and TestFlight install, so day 10 repeats a proven path (§13).
- **Circles and the Activity rings:** Apple's guideline 5.2.5 says apps shouldn't show Move, Exercise or Stand data in a way that resembles the Activity rings. Saebom's rings show sets and sessions in its own colors, never as three nested rings.
- **Design time:** the rings and transitions are built into the session and progress screens rather than added at the end; if a day runs over, polish goes before tests (§14).
- **Training injured areas light (D46–D47):** even light loading can aggravate an injury. Train-around is the default, light needs the tester to acknowledge a direct warning (no clearance required, by the owner's choice), light exercises are capped and kept away from the coach, and "Pain? Stop" is one tap. Before the public launch, have a physical therapist review the light rules.
- **Real data on Supabase Free:** no service-level agreement or managed backups. Accepted for the beta and the public launch (D32), with nightly encrypted backups and regular restore drills.
- **Individual publisher (Apple 5.1.1(ix)):** fine for TestFlight; revisit before the public launch (§18).
- **Expo SDK:** use the latest stable release on day 1 and follow its docs.
- **Keep-alive:** confirm the nightly job's API call stops the project from pausing.
- **Facts not re-opened on Oct 14** (the pages couldn't be loaded that day): TestFlight's 90-day build expiry, iOS's limit of about 64 pending local notifications, Expo's SecureStore size guidance and its privacy-manifest setting, and the OWASP Mobile Top 10 (2024) names. Confirm them on day 1.
- **Agent throughput on Claude Pro (D64):** the five-hour and weekly limits are shared with claude.ai and can stall a task partway through. Lower effort to medium first, then continue in Antigravity CLI; if that still isn't enough, cut from §14's list, never tests.
- **Antigravity CLI (D63–D64):** it replaced Gemini CLI for Google AI Pro on June 18, 2026, and it's closed-source. `--model gemini-4-argon` may not be recognized and silently fall back to Gemini 3.8 Flash (antigravity-cli issue #1228); the review script reports which model ran. Workspace hooks load only in a trusted folder, and no hook runs under `--dangerously-skip-permissions`, which D65 bans.
- **What the guard can't see (D65):** it reads command text, so commands hidden in script files or interpreters (`bash x.sh`, `node -e`) and files a program opens without naming them get past it. The deny rules, the ruleset on `main` and the owner's review cover those.
- **Gemini and data (D63):** Google AI Pro's terms don't say whether prompts train Google's models, so only diffs bound for the public repo go to Gemini, after a secret check.

## 17. How to continue

1. Read §0–3 before writing code. In the repo, `CLAUDE.md` carries the working rules, coding standards and commands.
2. The "Before Oct 26" list in §13 is finished; the setup troubleshooting table there covers the errors met so far.
3. Start at the first unchecked item in §14 with an agent session (`docs/agent-workflow.md`): one task, one worktree, one pull request, a second review, then the owner reviews and merges (D58–D63).
4. Log new decisions in §3 with a reason; tick items off and update the status line as you go.
5. Recheck the limits in §4 on day 1.

## 18. After the beta: public launch (phase 2)

Saebom goes public as a free App Store app once the beta has run long enough to trust; there's no date yet (D32). The budget grows by a domain only, about $10–15 a year, so the app stays on Supabase Free with the nightly backups.

**Accounts and email**

- [ ] Buy a domain. Host the privacy policy and a support page on it; GitHub Pages with a custom domain is free.
- [ ] Set up a free email-sending service on the domain and connect it to Supabase Auth as custom SMTP, for sign-up codes and password resets. Check the provider's free limits when choosing.
- [ ] Open sign-ups: the invite hook becomes an abuse filter (for example, blocking disposable email domains), MFA stays required, and a CAPTCHA guards sign-ups and demo mode. Supabase Auth supports CAPTCHA providers; check how it works from React Native first.
- [ ] Self-service password reset by email code replaces the owner's reset script.

**App Store**

- [ ] App Privacy details in App Store Connect: health and fitness data and contact info, linked to the user, not used for tracking.
- [ ] Listing: name, subtitle, description, keywords, screenshots made with demo data, support and privacy policy URLs, and the age rating.
- [ ] Review notes pointing to demo mode, plus a review account.
- [ ] Apple 5.1.1(ix): apps that require sensitive information may be expected to come from a legal entity. Keep the data minimal (D25). If review raises it, forming a company is the fallback, outside the current budget.

**Legal and privacy**

- [ ] Washington's My Health My Data Act applies once Washington residents sign up. The consent ledger, health data privacy policy and in-app deletion already cover its core; link the policy from the App Store page and the app.
- [ ] Publish privacy policy version 2 for the public, which asks for consent again in the app.
- [ ] Rehearse the incident-response runbook once (FTC breach notification).
- [ ] A privacy lawyer's review is worth it if the budget allows; it isn't in the current one.

**Scale and operations**

- [ ] Supabase Free's limits (500 MB, 50,000 monthly active users) are far above early needs. Keep the nightly backups and run a restore drill monthly; the lack of a service-level agreement is an accepted risk.
- [ ] The AI coach: once more than about 70 users opt in, spread reviews across the week, since each day's run tops out near 80; the 8B model nearly halves the cost per review if needed.
- [ ] Watch crash reports in App Store Connect; still no third-party analytics (D25).
- [ ] Keep TestFlight for betas of each new version.

**Features waiting from v1:** the trend line chart, the consent-history screen, automatic upload retry, three demo lifters, the rest timer, kilograms, the full profile editor, "Ask the coach" and bodyweight moves.

**Not planned:** Android (Google Play's registration fee isn't in the budget, though Expo keeps the door open), Apple Health and payments.

## 19. Sources (checked Oct 13–15 and Oct 28, 2026)

- Apple: App Review Guidelines (last updated June 8, 2026) — https://developer.apple.com/app-store/review/guidelines/
- Apple: TestFlight — https://developer.apple.com/testflight/
- Apple: Provide test information — https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information
- Apple: Developer Program fee waiver page (states the 99 USD fee) — https://developer.apple.com/support/membership-fee-waiver/
- Expo pricing — https://expo.dev/pricing
- Supabase: Use Supabase Auth with React Native — https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase: Securing Edge Functions — https://supabase.com/docs/guides/functions/auth
- Supabase: Scheduling Edge Functions — https://supabase.com/docs/guides/functions/schedule-functions
- Supabase: Auth Hooks — https://supabase.com/docs/guides/auth/auth-hooks
- Supabase: Before User Created hook — https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- Supabase: Anonymous Sign-Ins — https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Auth source, anonymous sign-up checks the sign-up setting — https://github.com/supabase/auth/blob/master/internal/api/anonymous.go
- Supabase: changes to the default email provider — https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider
- Supabase pricing — https://supabase.com/pricing
- Supabase: Multi-Factor Authentication — https://supabase.com/docs/guides/auth/auth-mfa
- Security at Supabase — https://supabase.com/security
- Workers AI pricing — https://developers.cloudflare.com/workers-ai/platform/pricing/
- Workers AI JSON Mode — https://developers.cloudflare.com/workers-ai/features/json-mode/
- Workers AI REST API — https://developers.cloudflare.com/workers-ai/get-started/rest-api/
- Workers AI data usage — https://developers.cloudflare.com/workers-ai/platform/data-usage/
- OWASP Mobile Top 10 — https://owasp.org/www-project-mobile-top-10/
- 45 CFR 164.312, Technical safeguards — https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312
- HHS: HIPAA Security Rule NPRM fact sheet — https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html
- FTC: Health Breach Notification Rule, the Basics for Business — https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business
- FTC: Complying with the FTC's Health Breach Notification Rule (checked Oct 30; the deadlines in `docs/incident-response.md`) — https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0
- Washington AG: My Health My Data Act guidance — https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy
- GitHub Docs: Code scanning — https://docs.github.com/en/code-security/concepts/code-scanning/code-scanning
- App name checks (Oct 15): App Store listings for "BestLift - Track Your Workouts" (https://chrome-stats.com/d/id1452048800), "Liftoff - Ranked Gym Workouts" (https://apps.apple.com/us/app/liftoff-ranked-gym-workouts/id6448081563) and "Kickoff Personal Training" (https://apps.apple.com/app/id1469977012) showed those names were taken; no app named Saebom turned up.

Added Oct 28, for the agent workflow (D58–D65):

- Noodle: introduction — https://poteto.github.io/noodle/introduction.html; modes — https://poteto.github.io/noodle/concepts/modes.html; configuration — https://poteto.github.io/noodle/reference/configuration.html
- pstack (Claude Code build in the `cursor-plugins` marketplace) — https://github.com/cursor/plugins/tree/main/pstack
- Claude Code: hooks — https://code.claude.com/docs/en/hooks; permissions — https://code.claude.com/docs/en/permissions; permission modes — https://code.claude.com/docs/en/permission-modes; worktrees — https://code.claude.com/docs/en/worktrees; memory and AGENTS.md — https://code.claude.com/docs/en/memory; plugins for a repository — https://code.claude.com/docs/en/plugins/org
- Claude Code with the Pro and Max plans (shared limits) — https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Antigravity CLI: headless mode — https://antigravity.google/docs/cli/headless/; hooks — https://antigravity.google/docs/hooks/; skills — https://antigravity.google/docs/skills/; models and plans — https://antigravity.google/docs/models/; migrating from Gemini CLI — https://antigravity.google/docs/cli/gcli-migration/
- Gemini CLI's move to Antigravity CLI — https://github.com/google-gemini/gemini-cli/discussions/27274; the Gemini 4 Argon model-name bug — https://github.com/google-antigravity/antigravity-cli/issues/1228
- GitHub Docs: About rulesets (availability by plan) — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
