#!/bin/bash
# Saebom autopilot (D67, D69): starts the next §14 task in each lane as soon as the owner merges.
#
#   npm run autopilot          (run it from ~/Development/saebom, in its own Terminal window)
#
# Work runs in two lanes (D69): app (app/) and backend (everything else). Every minute the
# autopilot checks GitHub. When main gets a new commit (your merge), it starts a session in each
# lane that still has unchecked §14 items, no open pull request and no running session. A pull
# request without a "Lane: app" or "Lane: backend" line counts against both lanes. Each session
# opens in a new Terminal window running `claude -w next-<lane>-<time>` with that lane's prompt.
# Meanwhile it logs what happens: merges, pull requests opened, second reviews posted, questions
# asked. It never merges, pushes or touches production; it only opens the sessions you'd open
# by hand.
#
# Keys while it waits: Enter starts every lane that can start, f then a or b starts the app or
# backend lane anyway, s shows the status, q quits. Keys typed while it's busy are discarded, and it
# never starts the same lane twice within 2 minutes.
# AUTOPILOT_DRY_RUN=1 prints the sessions instead of opening them; AUTOPILOT_ONCE=1 checks once
# and exits; AUTOPILOT_INTERVAL sets the seconds between checks (default 60); AUTOPILOT_LANES=app
# or AUTOPILOT_LANES=backend runs one lane only, to save Claude usage. Works with the
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
LANES=${AUTOPILOT_LANES:-app backend}
for lane in $LANES; do
  case "$lane" in
    app | backend) ;;
    *) echo "AUTOPILOT_LANES takes app, backend or both, not '$lane'."; exit 1 ;;
  esac
done
COOLDOWN_S=120
OPEN_PRS=''
REASON=''

# The lane of an open pull request: its "Lane:" line, or "any" when it has none.
PR_JQ='.[] | "\(.number)\t\(([.body // "" | capture("(^|\n)Lane: (?<l>app|backend)\\b").l] | first) // "any")\t\(.title)"'

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

# The §14 label of a lane: App, Backend or Owner.
label() {
  case "$1" in
    app) echo App ;;
    backend) echo Backend ;;
    *) echo Owner ;;
  esac
}

remote_main() { git ls-remote origin refs/heads/main 2>/dev/null | cut -f1; }

# One line per open pull request: number<TAB>lane<TAB>title
open_prs() { gh pr list --state open --json number,title,body --jq "$PR_JQ" 2>/dev/null; }

# How many open pull requests block a lane: its own, plus those with no lane.
lane_prs() {
  printf '%s\n' "$OPEN_PRS" | awk -F'\t' -v lane="$1" '$1 != "" && ($2 == lane || $2 == "any")' |
    grep -c .
}

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

section14() {
  git show origin/main:docs/HANDOFF.md 2>/dev/null | awk '/^## 14\./{f=1; next} /^## 15\./{f=0} f'
}

# Unchecked §14 items for a lane (app, backend or owner), by their bold label (D71).
unchecked_items() { section14 | grep -c "^- \[ \] \*\*$(label "$1"):\*\*"; }

# Unchecked §14 items with no lane label, which no lane picks up.
unlabeled_items() { section14 | grep '^- \[ \]' | grep -vcE '^- \[ \] \*\*(App|Backend|Owner):\*\*'; }

# A session in this lane, or one started before lanes existed (next-<date>), is running.
session_running() {
  pgrep -f "claude -w next-$1-" >/dev/null 2>&1 || pgrep -f 'claude -w next-[0-9]' >/dev/null 2>&1
}

# Seconds since this autopilot last started a task in a lane (a large number if never).
since_last_start() {
  local last
  last=$(cat "$STATE/last-start-$1" 2>/dev/null)
  echo $(($(date +%s) - ${last:-0}))
}

# Succeeds when a lane may start a task now; otherwise sets REASON.
can_start() {
  local prs
  prs=$(lane_prs "$1")
  if [ "$(unchecked_items "$1")" -eq 0 ]; then
    REASON='no unchecked items in this lane'
  elif [ "$(since_last_start "$1")" -lt "$COOLDOWN_S" ]; then
    REASON='a task in this lane started less than 2 minutes ago'
  elif [ "$prs" -gt 0 ]; then
    REASON="$prs pull request(s) open for this lane"
  elif session_running "$1"; then
    REASON='a session in this lane is still running'
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

# The next-task prompt for a lane (D68–D71).
prompt_for() {
  local lane=$1 name
  name=$(label "$lane")
  printf '%s' "/pstack:poteto-mode You work the $lane lane (D69). Take the earliest day in §14 of docs/HANDOFF.md that has unchecked **$name:** items no open pull request covers, and do all of that day's $name items in one PR, one commit per item, ticking each one (D68). If that day's $name work is small, add the next day's $name items. Skip **Owner:** items and the other lane's items. If an item needs the other lane's work that isn't on main yet, build against the contract in the handoff and say so under Scope. End the PR body with the Lane: $lane, Review: and iPhone: lines from CLAUDE.md (D70). Then run the second-review skill. Stop when the PR is ready for my review."
}

update_main() {
  if [ "$(git branch --show-current)" = main ]; then
    git merge -q --ff-only origin/main 2>/dev/null ||
      log "Couldn't fast-forward your main checkout (local changes?). Sessions still start from GitHub's main."
  else
    log "Your main checkout is on $(git branch --show-current), not main. The guard hook runs from it, so switch back when you can."
  fi
}

start_task() {
  local lane=$1 topic file
  topic="next-$lane-$(date +%m%d-%H%M)"
  file="$STATE/$topic.command"
  {
    echo '#!/bin/bash'
    echo "export PATH=$(quote "$PATH")"
    echo "cd $(quote "$MAIN") || exit 1"
    echo "claude -w $topic $(quote "$(prompt_for "$lane")")"
  } >"$file"
  chmod +x "$file"
  if [ -n "${AUTOPILOT_DRY_RUN:-}" ]; then
    log "Dry run: would open a $lane session in worktree $topic:"
    sed 's/^/    /' "$file"
  else
    open -a Terminal "$file"
    log "Started the next $lane task in a new Terminal window (worktree $topic)."
    notify "Started the next $lane task (worktree $topic)."
  fi
  date +%s >"$STATE/last-start-$lane"
}

# Starts every lane that can start; logs why the others wait.
start_lanes() {
  local verb=$1 lane started=''
  for lane in $LANES; do
    if can_start "$lane"; then
      [ -n "$started" ] || update_main
      started=1
      start_task "$lane"
    else
      log "$verb the $lane lane: $REASON."
    fi
  done
  [ -n "$started" ] || log "Press f, then a or b, to start the app or backend lane anyway."
}

# Starts one lane even with its pull requests open or its session running.
force_lane() {
  if ! printf ' %s ' $LANES | grep -q " $1 "; then
    log "Not starting the $1 lane: this autopilot runs only $LANES (AUTOPILOT_LANES)."
  elif [ "$(unchecked_items "$1")" -eq 0 ]; then
    log "Not starting the $1 lane: no unchecked items in this lane."
  elif [ "$(since_last_start "$1")" -lt "$COOLDOWN_S" ]; then
    log "Not starting the $1 lane: a task in this lane started less than 2 minutes ago."
  else
    update_main
    start_task "$1"
  fi
}

show_status() {
  local prs questions number lane title unlabeled
  log "main: $(git log -1 --format='%h %s' origin/main 2>/dev/null). Unchecked §14 items: app $(unchecked_items app), backend $(unchecked_items backend), owner $(unchecked_items owner)."
  unlabeled=$(unlabeled_items)
  [ "$unlabeled" -eq 0 ] ||
    log "$unlabeled unchecked §14 item(s) have no App, Backend or Owner label, so no lane takes them."
  prs=$(open_prs)
  if [ -z "$prs" ]; then
    log "No open pull requests."
  else
    while IFS=$'\t' read -r number lane title; do
      [ -n "$number" ] || continue
      if has_second_review "$number"; then
        log "PR #$number ($lane) ready for your review: $title"
      else
        log "PR #$number ($lane) in progress (no second review yet): $title"
      fi
    done <<<"$prs"
  fi
  questions=$(open_questions)
  while IFS=$'\t' read -r number title; do
    [ -n "$number" ] && log "Question #$number waits for your answer: $title"
  done <<<"$questions"
  for lane in $LANES; do
    if session_running "$lane"; then log "A $lane session is running."; fi
  done
}

# Reports new pull requests, second reviews and questions once each.
report_changes() {
  local prs questions number lane title
  prs=$(open_prs)
  while IFS=$'\t' read -r number lane title; do
    [ -n "$number" ] || continue
    if [ ! -e "$STATE/pr-$number" ]; then
      touch "$STATE/pr-$number"
      log "PR #$number opened ($lane): $title"
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
  OPEN_PRS=$prs
}

tick() {
  local head last owner
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
  if [ "$(unchecked_items app)" -eq 0 ] && [ "$(unchecked_items backend)" -eq 0 ]; then
    owner=$(unchecked_items owner)
    log "Every app and backend item in §14 is ticked; $owner owner item(s) remain. Autopilot is done."
    notify "Every app and backend item in §14 is ticked."
    exit 0
  fi
  start_lanes 'Waiting on'
}

log 'Saebom autopilot.'
git fetch -q origin main 2>/dev/null
show_status
log "Watching main at $(git log -1 --format='%h %s' origin/main 2>/dev/null)."
tick
[ -n "${AUTOPILOT_ONCE:-}" ] && exit 0
log 'Waiting for your next merge. Enter: start lanes now · f then a/b: app/backend anyway · s: status · q: quit'
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
        log 'Start which lane anyway? a: app, b: backend (any other key cancels)'
        if IFS= read -r -s -n 1 -t 10 key; then
          case "$key" in
            a | A) force_lane app ;;
            b | B) force_lane backend ;;
            *) log 'Cancelled.' ;;
          esac
        else
          log 'Cancelled.'
        fi
        ;;
      '')
        OPEN_PRS=$(open_prs)
        start_lanes 'Not starting'
        ;;
      *) continue ;;
    esac
  fi
  tick
done
