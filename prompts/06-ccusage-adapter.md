Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add a ccusage adapter to collect local AI coding-agent usage/spend metadata.

Important:
ccusage is adapter #1, not the foundation. Keep the collector interface generic so future adapters can be added.

Implement:
- floor200 collect usage
- checks that .floor200.yml exists
- checks that ccusage is installed/available
- runs ccusage in JSON mode
- parses usage records into normalized agent sessions
- writes .floor200/data/usage.json
- prints a short summary after collection

Normalized usage session shape:
- source
- sourceSessionId
- model
- startedAt
- endedAt
- durationMs
- inputTokens
- outputTokens
- cacheTokens
- totalTokens
- estimatedCostUsd
- repoPathHash or projectPathHash if available
- rawSource: "ccusage"

Privacy:
- do not store raw prompts
- do not store source-code contents
- do not store full terminal output
- hash local paths if path data is available

Do not add attribution yet.
Do not add recommendations yet.
Do not add a database yet.
Do not make direct API calls.

Acceptance criteria:
- pnpm build works
- pnpm test works
- floor200 collect usage fails clearly if .floor200.yml is missing
- floor200 collect usage fails clearly if ccusage is missing
- floor200 collect usage writes .floor200/data/usage.json
- parser has fixture tests
- external ccusage calls are wrapped and mockable
- parser is defensive if fields are missing or shaped differently than expected
