# Incident response

This runbook is for the owner. It says what to do when tester data may have reached someone it shouldn't have, and when the FTC Health Breach Notification Rule asks you to tell people (`docs/HANDOFF.md` §12). The owner is the whole team (D29), so the owner does every step. None of this is legal advice.

## Know what counts

Treat any of these as an incident:

- Someone without permission reads or copies tester data. Examples are a leaked secret key, a database password in a public log, or an RLS policy that lets one user read another user's rows.
- The app or a function shares tester data without the tester's consent. Examples are health data in an AI prompt, a notification, a log line, a public CI log, an issue or a pull request.
- A secret leaks, even with no sign that anyone used it. Treat it as a possible breach until the logs show otherwise.

Tester data here means anything from `profiles`, the training tables, `consents` or `audit_events`, with or without the email. The testers are a small group of friends and family, so a user ID or a few rows can be enough to tell who someone is. The FTC counts health data as unsecured unless it was encrypted in the way HHS specifies. Treat a leak of production data as unsecured. An encrypted backup that leaks without its age private key is secured.

Supabase, Cloudflare, GitHub and Apple are service providers. If one of them tells you about a breach on their side, start at step 1 below.

## Respond

1. **Write down the time you found out.** The FTC deadlines count from discovery. Keep incident notes in your password manager or another private place, never in the repo, an issue or a pull request.
2. **Stop the leak.** Rotate what leaked and anything it could reach, then put the new value everywhere the old one lived:
   - Rotate the Supabase secret key. Update the Edge Function environment, `scripts/.env.local` and the GitHub Actions secrets.
   - Rotate the named `cron` key. Update `cron_key` in Vault.
   - Reset the database password. Update the GitHub Actions secret.
   - Revoke the Workers AI token and make a new one. Update the Supabase secret.
   - Rotate the JWT signing key and revoke the old one. That signs every tester out.

   A secret pushed to the public repo stays in its history and in every fork, so rotate it even after you delete the commit. If health data reached a public Actions log, delete that run's logs in GitHub.

3. **Find out what happened.** Answer four questions in your notes: what data, whose, from when to when, and who got it. Use `audit_events` and the Supabase logs.
4. **Decide whether to notify.** You notify when unsecured, identifying health data of a tester was acquired or shared without the tester's permission. If you can't rule that out, notify.
5. **Fix the cause** in a pull request. Describe the bug in it, but leave out tester data and anything that would help someone repeat the attack.

## Notify

The deadlines come from the FTC's guide [Complying with the FTC's Health Breach Notification Rule](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0).

| Who                                                                       | When                                                                  | How                                                                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Each affected tester                                                      | Without unreasonable delay, within 60 calendar days of discovery      | Email, plus a text message or an in-app banner. Offer first-class mail instead of email.                    |
| The FTC, fewer than 500 people affected                                   | Within 60 calendar days after the end of the calendar year            | The [Notice of Breach of Health Information](https://www.ftc.gov/business-guidance/health-breach-form) form |
| The FTC, 500 or more people affected                                      | At the same time as the testers, within 60 calendar days of discovery | The same form                                                                                               |
| Prominent media in the state, 500 or more residents of one state affected | Within 60 calendar days of discovery                                  | A notice to local media, in addition to the testers' notices                                                |

The beta has friends and family only, so the first two rows are the ones that apply. The notice to each tester says:

- what happened, with the date of the breach if you know it, the date you found out, and who got the data;
- what kinds of data were involved;
- what the tester can do to protect themselves;
- what you are doing to investigate, to limit the harm and to stop it happening again;
- at least two ways to reach you from the FTC's list: an email address, a postal address, a website, the app itself or a toll-free phone number.

Some states' breach laws may also cover health data. Check the affected testers' states before you send.

## Rehearse

Run through this runbook once with a made-up incident before the public launch (§18). Fix whatever step didn't work.
