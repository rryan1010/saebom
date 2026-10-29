---
name: log-decision
description: Record a Saebom product decision in docs/HANDOFF.md §3 and bring the spec, CLAUDE.md and tests in line in the same PR. Use when the owner answers a question issue, states or changes a requirement, or an agreed change alters a rule in the handoff.
---

# Log a decision (D40, D61)

A decision lives in `docs/HANDOFF.md` §3, and everything that depends on it changes in the same pull request. That keeps one source of truth.

1. **Take the next number.** `grep -oE '^\| D[0-9]+' docs/HANDOFF.md | tail -1` shows the last decision.
2. **Add the row** to the §3 table:
   `| D<n> | <the decision, stated as a rule> | <the reason, whose call and when, such as "Owner's answer to #12 (Oct 29)"> |`
   If it replaces an older decision, start that row with `**Changed <date> (D<n>).**`. Never delete a row.
3. **Change what depends on it, in the same PR:**
   - the spec sections it touches (§6 data model, §7 plan engine, §8–§12);
   - `CLAUDE.md`, if a rule, command or convention changed;
   - tests: a decision that changes behavior gets a test that fails without it;
   - §14, if it adds or removes build work;
   - the version, the status line and §0's newest "What changed" list at the top of the handoff.
4. **Close the loop.** In the PR body, add `Decisions: D<n>` and `Closes #<question issue>`, so merging the PR closes the question.
5. **Remind the owner** in the PR body to refresh the claude.ai project copies of `HANDOFF.md` and `CLAUDE.md` after merging (D40).

Write each decision as a rule a reader can apply without the conversation that produced it.
