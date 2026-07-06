#!/usr/bin/env bash
# PostToolUse(Write|Edit|MultiEdit): exit 2 feeds stderr back to Claude.
# Type-checks the project after any .ts edit so errors surface immediately
# instead of at `pnpm build` (tsup does not fail the build on type errors).
set -euo pipefail

input="$(cat)"
file_path="$(echo "$input" | jq -r '.tool_input.file_path // ""')"

case "$file_path" in
  *.ts) ;;
  *) exit 0 ;;
esac

[[ -x "$CLAUDE_PROJECT_DIR/node_modules/.bin/tsc" ]] || exit 0

if ! out="$("$CLAUDE_PROJECT_DIR/node_modules/.bin/tsc" --noEmit -p "$CLAUDE_PROJECT_DIR" 2>&1)"; then
  echo "tsc errors:" >&2
  echo "$out" | grep -E 'error TS' | head -20 >&2
  exit 2
fi

exit 0
