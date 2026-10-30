#!/bin/bash
# Saebom autopilot (D67): starts the next §14 task as soon as the owner merges a pull request.
#
#   npm run autopilot          (run it from ~/Development/saebom, in its own Terminal window)
#
# Every minute it checks GitHub. When main gets a new commit (your merge), no pull request
# is open and no session it started is still running, it updates your main checkout and opens
# a new Terminal window running `claude -w <topic>` with the next-task prompt. Meanwhile it logs
# what happens: merges, pull requests opened, second reviews posted, questions asked. It
# never merges, pushes or touches production; it only opens the session you'd open by hand.
#
# Keys while it waits: Enter starts a task now (if no PR is open and no session is running),
# f starts one anyway, s shows the status, q quits. Keys typed while it's busy are discarded,
# and it never starts two tasks within 2 minutes.
# AUTOPILOT_DRY_RUN=1 prints the session instead of opening it; AUTOPILOT_ONCE=1 checks once
# and exits; AUTOPILOT_INTERVAL sets the seconds between checks (default 60). Works with the
# bash that ships with macOS (3.2).

set -u

MAIN=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)/.." 2>/dev/null && pwd) || MAIN=''
if [ -z "$MAIN" ] || [ ! -f "$MAIN/docs/HANDOFF.md" ]; then
  echo "Run this inside the saebom repo (npm run autopilot)."
  exit 1
fi
cd "$MAIN" || exit 1
STATE="$MAIN/.git/autopilot" # inside .git, so it's never committed
mkdir -p "$STATE"
INTERVAL=${AUTOPILOT_INTERVAL:-60}
SESSION_PATTERN='claude -w next-'
COOLDOWN_S=120
OPEN_PR_COUNT=0
REASON=''

PROMPT='/pstack:poteto-mode Take the next task from §14 of docs/HANDOFF.md: the first unchecked item that no open pull request covers. If that item is an owner-only step (CLAUDE.md, "Owner only"), skip it, name it in your final message, and take the next one. One task, one PR, then run the second-review skill. Stop when the PR is ready for my review.'

log() { printf '%s  %s\n' "$(date +%H:%M)" "$*"; }

notify() {
  local message=${1//\"/\'}
  message=${message//\\/}
  osascript -e "display notification \"$message\" with title \"Saebom autopilot\"" >/dev/null 2>&1
  printf '\a'
}

for tool in git gh; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool isn't installed or isn't on PATH."; exit 1; }
done
if [ -z "${AUTOPILOT_DRY_RUN:-}" ] && ! command -v claude >/dev/null 2>&1; then
  echo "claude isn't on PATH. Start this from the same Terminal you run Claude Code in."
  exit 1
fi

remote_main() { git ls-remote origin refs/heads/main 2>/dev/null | cut -f1; }

# One line per open pull request: number<TAB>title
open_prs() { gh pr list --state open --json number,title --jq '.[] | "\(.number)\t\(.title)"' 2>/dev/null; }

has_second_review() {
  local count
  count=$(gh pr view "$1" --json comments \
    --jq '[.comments[].body | select(startswith("**Second review**"))] | length' 2>/dev/null)
  [ "${count:-0}" -gt 0 ]
}

# One line per open question issue: number<TAB>title
open_questions() {
  gh issue list --label question --state open --json number,title \
    --jq '.[] | "\(.number)\t\(.title)"' 2>/dev/null
}

unchecked_items() {
  git show origin/main:docs/HANDOFF.md 2>/dev/null |
    awk '/^## 14\./{f=1; next} /^## 15\./{f=0} f' | grep -c '^- \[ \]'
}

session_running() { pgrep -f "$SESSION_PATTERN" >/dev/null 2>&1; }

# Seconds since this autopilot last started a task (a large number if never).
since_last_start() {
  local last
  last=$(cat "$STATE/last-start" 2>/dev/null)
  echo $(($(date +%s) - ${last:-0}))
}

# Succeeds when a task may start now; otherwise sets REASON.
can_start() {
  if [ "$(since_last_start)" -lt "$COOLDOWN_S" ]; then
    REASON='a task started less than 2 minutes ago'
  elif [ "$OPEN_PR_COUNT" -gt 0 ]; then
    REASON="$OPEN_PR_COUNT pull request(s) still open"
  elif session_running; then
    REASON='an autopilot session is still running'
  else
    return 0
  fi
  return 1
}

# Drops keys typed while the autopilot was busy, so stray typing can't start a task.
flush_input() {
  [ -t 0 ] && perl -MPOSIX -e 'POSIX::tcflush(0, POSIX::TCIFLUSH())' 2>/dev/null
  return 0
}

# Wraps a value in single quotes for a shell script, keeping non-ASCII text readable.
quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }

start_task() {
  local topic file
  topic="next-$(date +%m%d-%H%M)"
  if [ "$(git branch --show-current)" = main ]; then
    git merge -q --ff-only origin/main 2>/dev/null ||
      log "Couldn't fast-forward your main checkout (local changes?). The session still starts from GitHub's main."
  else
    log "Your main checkout is on $(git branch --show-current), not main. The guard hook runs from it, so switch back when you can."
  fi
  file="$STATE/$topic.command"
  {
    echo '#!/bin/bash'
    echo "export PATH=$(quote "$PATH")"
    echo "cd $(quote "$MAIN") || exit 1"
    echo "claude -w $topic $(quote "$PROMPT")"
  } >"$file"
  chmod +x "$file"
  if [ -n "${AUTOPILOT_DRY_RUN:-}" ]; then
    log "Dry run: would open a session in worktree $topic:"
    sed 's/^/    /' "$file"
  else
    open -a Terminal "$file"
    log "Started the next task in a new Terminal window (worktree $topic)."
    notify "Started the next task (worktree $topic)."
  fi
  date +%s >"$STATE/last-start"
}

show_status() {
  local prs questions number title
  log "main: $(git log -1 --format='%h %s' origin/main 2>/dev/null). Unchecked §14 items: $(unchecked_items)."
  prs=$(open_prs)
  if [ -z "$prs" ]; then
    log "No open pull requests."
  else
    while IFS=$'\t' read -r number title; do
      [ -n "$number" ] || continue
      if has_second_review "$number"; then
        log "PR #$number ready for your review: $title"
      else
        log "PR #$number in progress (no second review yet): $title"
      fi
    done <<<"$prs"
  fi
  questions=$(open_questions)
  while IFS=$'\t' read -r number title; do
    [ -n "$number" ] && log "Question #$number waits for your answer: $title"
  done <<<"$questions"
  if session_running; then log "An autopilot session is running."; fi
}

# Reports new pull requests, second reviews and questions once each.
report_changes() {
  local prs questions number title
  prs=$(open_prs)
  while IFS=$'\t' read -r number title; do
    [ -n "$number" ] || continue
    if [ ! -e "$STATE/pr-$number" ]; then
      touch "$STATE/pr-$number"
      log "PR #$number opened: $title"
      notify "PR #$number opened: $title"
    fi
    if [ ! -e "$STATE/review-$number" ] && has_second_review "$number"; then
      touch "$STATE/review-$number"
      log "PR #$number is ready for your review (second review posted)."
      notify "PR #$number is ready for your review."
    fi
  done <<<"$prs"
  questions=$(open_questions)
  while IFS=$'\t' read -r number title; do
    [ -n "$number" ] || continue
    if [ ! -e "$STATE/question-$number" ]; then
      touch "$STATE/question-$number"
      log "Question #$number needs your answer: $title"
      notify "Question #$number needs your answer."
    fi
  done <<<"$questions"
  OPEN_PR_COUNT=$(printf '%s' "$prs" | grep -c .)
}

tick() {
  local head last
  head=$(remote_main)
  if [ -z "$head" ]; then
    log "Can't reach GitHub; trying again in ${INTERVAL}s."
    return
  fi
  last=$(cat "$STATE/last-main" 2>/dev/null)
  git fetch -q origin main 2>/dev/null
  report_changes
  if [ -z "$last" ]; then
    echo "$head" >"$STATE/last-main"
    return
  fi
  [ "$head" = "$last" ] && return
  echo "$head" >"$STATE/last-main"
  log "main moved: $(git log -1 --format='%h %s' origin/main)"
  notify "Merged: $(git log -1 --format='%s' origin/main)"
  if [ "$(unchecked_items)" -eq 0 ]; then
    log "Every §14 item is ticked. Autopilot is done."
    notify "Every §14 item is ticked."
    exit 0
  fi
  if can_start; then
    start_task
  else
    log "Waiting: $REASON. Press f to start a task anyway."
  fi
}

log 'Saebom autopilot.'
git fetch -q origin main 2>/dev/null
show_status
log "Watching main at $(git log -1 --format='%h %s' origin/main 2>/dev/null)."
tick
[ -n "${AUTOPILOT_ONCE:-}" ] && exit 0
log 'Waiting for your next merge. Enter: start a task now · s: status · q: quit'
if [ -t 0 ]; then
  stty -echo 2>/dev/null
  trap 'stty echo 2>/dev/null' EXIT
  trap 'exit 130' INT TERM
fi
while true; do
  flush_input
  if IFS= read -r -s -n 1 -t "$INTERVAL" key; then
    case "$key" in
      q | Q) log 'Autopilot stopped.'; exit 0 ;;
      s | S) show_status ;;
      f | F)
        if [ "$(since_last_start)" -lt "$COOLDOWN_S" ]; then
          log 'Not starting: a task started less than 2 minutes ago.'
        else
          start_task
        fi
        ;;
      '')
        OPEN_PR_COUNT=$(open_prs | grep -c .)
        if can_start; then
          start_task
        else
          log "Not starting: $REASON. Press f to start a task anyway."
        fi
        ;;
      *) continue ;;
    esac
  fi
  tick
done
