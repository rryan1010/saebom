# Saebom: notes for Antigravity CLI

Antigravity loads `AGENTS.md`, which links to `CLAUDE.md`. Every rule there applies to you: read "Claude" as "the agent". This file covers only what differs when Gemini does the work.

## When the owner runs you

- **Fallback coder (D64).** The owner switches to you when Claude's usage limits run out partway through a task. Continue the same task in the same worktree. First read `git status`, `git log --oneline main..HEAD` and the open PR (`gh pr view`), so you build on what's there.
- **Second reviewer (D63).** `scripts/agents/gemini-review.ts` runs you headless (`agy -p`) to review a pull request Claude wrote. In that run, review only: don't edit files, run commands or comment.

## Model and effort

Run on the latest Gemini flagship, Gemini 4 Argon as of Oct 28, 2026, at high effort (`agy --model <id> --effort high`; `agy models` lists the id). Effort never goes below medium (D64).

## pstack and the project skills

pstack is a Claude Code plugin and doesn't load here. Work the way it asks anyway: restate the goal, make the smallest change that meets it, write the test first for logic, and prove the change works on the real thing before you open a PR.

The project skills live in `.claude/skills/`. Open each one by path when it applies:

- A product question the handoff doesn't answer: `.claude/skills/ask-owner/SKILL.md`
- The owner answers a question or changes a requirement: `.claude/skills/log-decision/SKILL.md`
- A PR you wrote needs its second review, which Claude does: `.claude/skills/second-review/SKILL.md`. Never review your own PR.

## Guardrails

- `.agents/hooks.json` runs the same guard as Claude Code (`scripts/agents/guard.mjs`, through `guard-agy.sh`) before every tool call. A denial is the rule working: don't look for another way to run the command. If the work needs it, it's the owner's step.
- Never run with `--dangerously-skip-permissions`. Antigravity skips hooks under that flag, so the guard would stop working (D65).

## Pull requests

Put `Agent: Antigravity CLI · <model>` in the PR body. Claude reviews your PRs once its limits reset, and the owner merges after that review.
