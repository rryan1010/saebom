---
name: second-review
description: Have every Saebom pull request reviewed by the other model family before the owner sees it (Gemini for Claude's PRs, Claude for Gemini's), then triage the findings and post them on the PR. Use once a PR is open and its checks pass, and again after a large change to it.
---

# Second review (D63)

A reviewer from another model family catches what the author's model misses. Only findings you've checked reach the owner.

**Until Nov 4 (D74):** the second review is a separate Claude Code cloud session on Opus 5.5 at max effort, which the owner starts. It checks each finding against the code and posts the verified ones as one PR comment, in the format of step 4 with `Claude Opus 5.5 (max effort, cloud)` as the reviewer. It reads the diff with `gh pr diff <n>` and posts the comment with the GitHub connector, because `gh pr comment` can't write from the cloud (D75). A cloud coding session opens its PR and stops. The Gemini review below is the fallback when Claude's limits run out, and applies again as written after Nov 4.

## Who reviews

Read the `Agent:` line in the PR body.

- **Written by Claude**: Gemini reviews it; follow the steps below.
- **Written by Gemini** (Antigravity CLI): Claude reviews it in a Claude Code session. Read the diff (`gh pr diff <n>`) against the review bar in `scripts/agents/gemini-review.ts` (the `buildPrompt` list), then post the comment from step 4 with `Claude` as the reviewer. If Claude's limits are spent, leave the PR waiting. The owner merges no PR without its second review.

## Gemini review

1. Push the branch and make sure `npm run verify` passes, so the review sees the final code.
2. Run `node scripts/agents/gemini-review.ts <pr-number>`.
   - Exit 2: the diff looks like it holds a secret, and nothing was sent. Stop and fix the branch.
   - Exit 3: Antigravity CLI is missing, signed out or failed. Post `Second review pending: <reason>` on the PR, tell the owner, and move on. Don't skip the step silently.
   - A `Model used:` line means Antigravity fell back to another model. Keep the review, and say which model ran in the comment.
3. Check each finding against the code. For a claim about behavior, reproduce it with a test or a run. Then sort it:
   - **Confirmed**: fix it in a new commit. Blockers and majors always get fixed, minors when it's cheap. If one stays, say why.
   - **Rejected**: one line on why it's wrong, with the evidence.
4. Post one comment with `gh pr comment <n> --body-file <file>`:

   ```
   **Second review** · Gemini (<model used>) via Antigravity CLI · head <sha7>
   Fixed: F1 <title> (<commit>)
   Left for the owner: F3 <title>. <why>
   Rejected: F2 <title>. <why>
   ```

   When the review found nothing, write `No findings.` after the first line.

5. Run the review again only if later commits change behavior beyond the fixes.

Never put secrets, tester data or `.env` contents in a review prompt or comment.
