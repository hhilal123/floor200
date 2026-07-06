#!/usr/bin/env bash
# PreToolUse(Write|Edit): exit 2 blocks. Enforces AGENTS.md's "never store secrets
# or .env contents by default" rule on files and on literal secret-shaped content.
set -euo pipefail

input="$(cat)"
file_path="$(echo "$input" | jq -r '.tool_input.file_path // ""')"
content="$(echo "$input" | jq -r '(.tool_input.content // "") + "\n" + (.tool_input.new_string // "")')"

if echo "$file_path" | grep -Eqi '\.env(\.|$)|credentials\.json$|secrets\.ya?ml$'; then
  echo "BLOCKED: writing to a secrets/.env-shaped file is disallowed by AGENTS.md privacy rules: $file_path" >&2
  exit 2
fi

secret_pattern='AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN[A-Z ]*PRIVATE KEY-----'
if echo "$content" | grep -Eq "$secret_pattern"; then
  echo "BLOCKED: content looks like it contains a secret/API key/private key, which AGENTS.md forbids storing: $file_path" >&2
  exit 2
fi

exit 0
