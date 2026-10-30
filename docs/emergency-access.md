# Emergency access

This runbook is for the owner. It covers the three times the owner reaches into production for a tester: a lost authenticator, an export for a tester who can't use the app, and a restore from backup. It is the "emergency access procedure" in the HIPAA mapping (`docs/HANDOFF.md` §12).

## Ground rules

- Only the owner runs these steps (D29). Agents never touch production (`CLAUDE.md`, "Owner only").
- Run every step from the owner's Mac. The secret key comes from `scripts/.env.local` and never leaves it.
- Write an audit event for every action. The event names the action and the tester's user ID. It never holds health values: no weights, reps, records, injured areas or readiness answers.
- Don't browse tester data in the Supabase dashboard (§11). Use the dashboard only for the step that needs it, and look only at the rows that step names.
- Keep notes about the tester out of GitHub. The repo, its issues and its Actions logs are public.

## Check who is asking

Before you act on a request, confirm that it comes from the person you invited. Reply through a channel you already use with them, not through the message that made the request. If you can't confirm it, do nothing.

## Reset a lost authenticator

Use this when a tester lost the phone or the app that holds their authenticator code. The tester keeps their password and their data.

Deleting a factor doesn't sign anyone out. A session left on a lost phone could enroll a new authenticator once the old one is gone, so end the tester's sessions first.

1. Find the tester's user ID by email with the admin API (`auth.admin.listUsers`).
2. End the tester's sessions. In the SQL editor, delete the tester's rows from `auth.sessions`. Their refresh tokens go with them.
3. If the phone was lost, wait one hour before you continue. An access token issued before step 2 stays valid until it expires (`jwt_expiry = 3600` seconds).
4. List the tester's factors with `auth.admin.mfa.listFactors({ userId })`.
5. Delete each TOTP factor with `auth.admin.mfa.deleteFactor({ id, userId })`.
6. Write the audit event `mfa_factor_deleted`.
7. Tell the tester to sign in with their email and password. The app then asks them to enroll a new authenticator.

If the tester also forgot the password, run `npm run invite -- --reset <email>` after step 6. The tester signs in with the new one-time code, enrolls an authenticator, and sets a new password in Settings.

## Export a tester's data

Use this when a tester can't open the app and asks for a copy of their data. A tester who can sign in uses **Export my data** in Settings instead.

1. Collect the same rows that `export-data` returns for that user ID (§11), as JSON.
2. Write the audit event `data_exported`.
3. Send the file to the tester through the channel from [Check who is asking](#check-who-is-asking).
4. Delete every copy of the file from the Mac.

## Restore from a backup

Use this when production data is lost or corrupted, for example after a bad migration. `backup.yml` keeps one encrypted dump a night for 14 days (§12).

A restore must not bring back a tester who asked to be deleted. Testers delete their accounts in the app without telling you, so the damaged database is the only record of who left after the dump.

1. Download the newest good dump from the private bucket in the backup project.
2. Decrypt it with the age private key from your password manager.
3. Load the dump into the local stack and run `npm run test:db`, as in the restore drill (§12). Don't touch production until both pass.
4. Before you restore, read the `account_deleted` audit events newer than the dump from the damaged database. Save their user IDs on the Mac. If that table can't be read, tell every tester that a deleted account may have come back, and ask them to delete it again.
5. Restore the dump into production.
6. Delete the accounts from step 4 with `auth.admin.deleteUser`. Their rows cascade, as in `delete-account`.
7. Write the audit event `backup_restored`, with the dump's date.
8. Delete the decrypted dump and the saved user IDs from the Mac.
9. Tell the testers that workouts finished after the dump's time were lost. The app deletes a workout from the phone once it uploads, so the app can't send those workouts again.

## Tooling

No owner script runs these steps yet. `scripts/invite.ts` (§14, day 3) and `export-data` (§14, day 9) are the first pieces. Until a script covers a step, run it as a one-off from the Mac with the secret key from `scripts/.env.local`, and write the audit event in the same run.
