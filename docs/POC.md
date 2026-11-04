# Saebom phone-only proof of concept

**Current direction since Nov 2, 2026.** The production v1 in `docs/HANDOFF.md` (invite-only accounts, MFA, Supabase with RLS, consent, the AI coach, backups) was moving too slowly, so the owner switched to a proof of concept that runs on the phone alone. It merged as #32 (merge commit `6d40fad`) on Nov 3. This file says what it is, how to run it and how to bring sign-in back. The handoff's product rules still apply; its §14 schedule doesn't, for now.

## What it proves

The project's three goals, with no account and no network:

1. **A workout plan.** Five profile questions and the readiness warning (D49, word for word), then the plan engine in `supabase/functions/_shared/rules/` builds an A/B rotation with a calibration pass on the phone.
2. **Reminders when today's workout isn't recorded.** Local notifications on the chosen weekdays and time, scheduled 28 days ahead and skipped once today's session has started (§9, D9). `app.json` sets `enableRemoteNotifications: false`, so there's no push entitlement.
3. **A timed session that tracks weight and reps.** A full-screen session with a timer that survives backgrounding, steppers, effort ratings, "Pain? Stop", records, a summary and next targets from the engine's progression.

The app opens on four tabs, **Today · Plan · History · Settings**. Everything is saved as JSON in AsyncStorage under the key `saebom.workout.v1`, so deleting the app deletes the data.

**The state has a version.** `parseState` in `app/src/lib/workout.ts` returns an empty state for any version other than the current one. Any change to the state's shape needs a migration in `parseState`. Don't just bump the version: that would erase the owner's workout history.

## What's parked, not deleted

| Part                                                                                                         | Where it is now                                                           |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Sign-in, invite code, set password, MFA enroll and challenge                                                 | `app/src/parked/(auth)/`, unchanged and excluded from `app/tsconfig.json` |
| The auth client and session logic (`supabase.ts`, `AuthProvider.tsx`, `auth-state.ts`, `chunked-storage.ts`) | `app/src/lib/`, unused by any route. Their tests still run in `npm test`  |
| The Supabase backend: migrations, RLS, the invite hook, pgTAP and auth checks                                | `supabase/`, unchanged. CI still runs `npm run verify` on it              |
| Consent, the AI coach, backups, the Face ID app lock, uploading on Finish                                    | Not built. The handoff still specifies them                               |

The plan engine isn't parked: the app imports it as `@shared/rules/index.ts` and `@shared/rules/catalog.ts`, and its invariants in `CLAUDE.md` still hold.

## For agents

- **The phone-only app isn't a regression.** Don't restore sign-in, Supabase or the parked screens unless the owner asks.
- **Don't pick work from §14 on your own.** Its days still describe the backend-first plan. Do the task the owner names. The autopilot (`npm run autopilot`) picks from §14, so it would start backend-first sessions.
- **Still in force:** the "Never" rules in `CLAUDE.md`, the plan engine's invariants, the safety texts word for word (the D49 readiness warning and the §11 light-training warning), and no health data in notifications or logs.
- **Keep logic testable.** Put pure logic in `app/src/lib/` with no React Native imports, so Vitest covers it from the repo root. Screens stay thin.

## Run it on the iPhone

From `~/Development/saebom` on the Mac. The POC needs no `app/.env.local`.

```bash
git switch main && git pull
```

After a merge, GitHub deletes the PR's branch, so `git pull` on that branch does nothing. Switch to `main` first.

```bash
npm --prefix app run ios:device
```

This is the native rebuild. Run it the first time, and after any change to a native module, `app.json` or `app/plugins/`.

```bash
npm --prefix app start -- --clear
```

For JavaScript-only changes, start Metro this way, then reopen the app on the phone.

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

Only one Metro can run at a time. If this shows one, stop it with `kill <PID>`.

Only the phone shows notifications, keep-awake, haptics and the timer in the background, so the owner checks those on the iPhone.

### Checking it without a phone

Cloud agents can't run the Simulator or a device. The checks that work there:

```bash
npm test
npm --prefix app run typecheck
npm --prefix app run lint
npm run format:check
npm run test:agents
```

```bash
(cd app && EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir <a scratch dir>)
```

The export proves the iOS bundle builds. For a UI check, run `cd app && EXPO_OFFLINE=1 CI=1 BROWSER=none npx expo start --web --port 8081` in the background and drive it with Playwright at 390×844. After any `expo start`, delete `app/.expo/` and `app/expo-env.d.ts` before `format:check`. In the cloud, add packages with `EXPO_OFFLINE=1 npx expo install <package>` from `app/`, because the network proxy blocks `api.expo.dev`.

## Troubleshooting (found Nov 3)

These add to the §13 table in the handoff.

| Symptom                                                                        | Cause                                                                                                     | Fix                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linking fails with `Undefined symbols … facebook::react::Sealable::Sealable()` | The prebuilt React Native core in Pods is the Release build, and the Debug/Release swap was skipped       | `echo Release > app/ios/Pods/React-Core-prebuilt/.last_build_configuration`, then build again. If that doesn't work, run `(cd app && npx expo prebuild -p ios --clean)` |
| "EXPO_PUBLIC_SUPABASE_URL is not set", with `app/app/(auth)/…` in the stack    | The phone is running code from before commit `d50b88c`, when the sign-in screens were still in `app/app/` | `git switch main && git pull`, then `npm --prefix app start -- --clear` and reopen the app                                                                              |

## Bringing sign-in back

Only when the owner asks. In one PR:

1. **Move the screens back.** Run `git mv 'app/src/parked/(auth)' 'app/app/(auth)'`. They're out of `app/app/` because in development Expo Router loads every file there at startup, and they need the Supabase settings.
2. **Type-check them again.** Remove the `src/parked` entry from `exclude` in `app/tsconfig.json`. They weren't type-checked while parked, so fix any drift that `npm --prefix app run typecheck` finds.
3. **Restore the auth guard** in `app/app/_layout.tsx`. The version from before the POC is `git show 493b576:app/app/_layout.tsx`. It wraps the stack in `<AuthProvider>`, maps `useAuthStatus()` to a landing route (`signedOut` to `/sign-in`, and so on), and guards each `(auth)` screen by status. Keep the POC's two guards (the tabs, session, summary and profile when a plan exists; onboarding when it doesn't) and nest them under `status === 'signedIn'`. The old `app/app/index.tsx` is gone: the `(tabs)` group now answers `/`.
4. **Add the settings.** Create `app/.env.local` from `app/.env.example`, with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`npx supabase status` gives the local ones). `supabase.ts` throws at startup without them. Never commit the file.
5. **Then the uploads.** Sending finished sessions to `finish-workout`, and deciding what happens to the workouts already on the phone, are separate tasks for the owner to schedule.
