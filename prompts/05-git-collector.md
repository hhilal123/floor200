Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add a local git collector.

Implement:
- floor200 collect git
- reads .floor200.yml
- verifies current directory is inside a git repo
- gets repo root
- gets current branch
- gets remote origin URL if available
- collects commits since a date
- writes normalized commits to .floor200/data/commits.json
- prints a short summary after collection

Command behavior:
- floor200 collect git
  - default since date: start of current month
- floor200 collect git --since YYYY-MM-DD
  - collect commits since that date

Normalized commit shape:
- sha
- message
- authorName
- authorEmailHash
- committedAt
- branchName
- additions
- deletions
- filesChanged
- files: [{ path, additions, deletions }]

Privacy:
- hash author emails
- do not store file contents
- do not store full diffs
- only store file paths and line counts

Do not add a database yet.
Do not add ccusage yet.
Do not add attribution yet.
Do not make network calls.

Acceptance criteria:
- pnpm build works
- pnpm test works
- floor200 collect git fails clearly if .floor200.yml is missing
- floor200 collect git fails clearly if not inside a git repo
- floor200 collect git writes .floor200/data/commits.json
- parser has fixture tests
- external git calls are wrapped and mockable
