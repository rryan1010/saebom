---
name: ask-owner
description: Ask the owner a Saebom product or preference question as a GitHub issue, then keep working. Use when the handoff doesn't say what the app should do, no experiment can settle it, and a wrong guess means rework or touches safety. Not for technical choices you can test.
---

# Ask the owner (D61)

The owner makes product calls; agents don't guess them. A GitHub issue reaches the owner's phone and leaves a record the decision log can cite.

## Before you ask

1. Search the spec and earlier questions. Read `docs/HANDOFF.md` §3 (decisions) and the sections for the feature, then run `gh issue list --label question --state all --search "<keywords>"`. If the answer exists, follow it.
2. If running something could settle it (behavior, layout, timing, performance), run the experiment instead, as pstack's Prototype playbook does. Ask only what the app should do or what the owner prefers.

## Ask

Write the body to a temp file under these headings, then run
`gh issue create --label question --title "Q: <the question in one line>" --body-file <file>`:

```
### Question
One sentence the owner can answer in one line.

### Context
The §14 item you're building and why the spec doesn't settle it. Cite sections and D-numbers.

### Options
Two or three, each with its trade-off. Mark the one you'd pick and say why.

### Default meanwhile
What you'll do until the owner answers, or "Blocked: parked".

### Blocks
The branch or PR that waits on the answer.
```

The repo is public: no secrets, tester data or health data in an issue.

## Then

- If a safe default exists and is cheap to change, keep going with it. List the issue under "Open questions" in the PR body, and keep the default in one place so the answer is a small change.
- If the question touches a safety rule (injured areas, rep caps, warnings, consent, data handling, security), don't guess. Park that part, say so in the issue, and move to the next §14 task.
- When the owner answers, run the **log-decision** skill.
