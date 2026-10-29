#!/bin/sh
# Runs the Saebom guard (scripts/agents/guard.mjs) as an Antigravity CLI hook (D65).
# Antigravity starts hooks with a trimmed environment, so Node may not be on PATH;
# look where nvm and Homebrew install it. If Node can't be found, deny the call:
# Antigravity treats a failing hook as a block anyway, and this says why.
NODE=$(command -v node 2>/dev/null)
if [ -z "$NODE" ]; then
  for dir in "$HOME"/.nvm/versions/node/v24*/bin /opt/homebrew/bin /usr/local/bin; do
    [ -x "$dir/node" ] && NODE="$dir/node"
  done
fi
if [ -z "$NODE" ]; then
  echo '{"decision":"deny","reason":"Saebom guard: Node.js was not found, so the guard blocks every call. See Troubleshooting in docs/agent-workflow.md."}'
  exit 0
fi
exec "$NODE" --no-warnings "${0%/*}/guard.mjs"
