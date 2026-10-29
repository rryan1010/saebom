# pstack model configuration for Saebom (D64). One line per role; a missing line falls back to the skill default.
# Claude Pro only: no Fable (it bills to usage credits), and single-model panels to save usage. Gemini is the
# cross-family reviewer through the second-review skill, so pstack's own panels don't need a second family.
# Effort never goes below medium: scripts/agents/guard.mjs denies subagents at effort "low".
# Edit this file instead of running /pstack:setup-pstack, which writes a user-level rule that would conflict.
# budget: medium (high)
feature, refactoring: sonnet high
bug-fix: sonnet high
perf-issue: sonnet high
hillclimb: sonnet high
judgment and prose: opus high
hardest tasks: opus high
how explorer: sonnet medium
how explainer: opus high
why investigators: sonnet medium
why synthesizer: opus high
reflect tooling: sonnet medium
reflect judgment, divergent, synthesizer: opus high
arena runners: sonnet high
arena cross-judge pool: opus high
swarm workers: sonnet medium
architect runners: opus high
interrogate reviewers: opus high
