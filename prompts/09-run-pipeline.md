Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add a single command that chains the full local pipeline so a new user can
go from zero to a report in one command.

Context:
docs/superpowers/specs/2026-07-06-launch-roadmap-and-positioning-design.md
identifies the first-run flow (five sequential commands) as the launch
bottleneck.

Implement:
- floor200 run
- chains, in order: collect git → collect prs → collect usage → attribute → report
- reuses collectGitCommits, collectPullRequests, collectUsage, runAttribution,
  runRoiReport — no new collection logic
- if .floor200.yml is missing, auto-runs floor200 init with defaults and
  continues (prints a note)
- degrades gracefully per step instead of failing the whole pipeline:
  - collect prs: gh missing, gh not authenticated, project.repo missing/invalid,
    or a GitHub API/parse failure → print a warning, skip PR collection, write
    an empty prs.json only if one doesn't already exist, and continue
  - collect usage: ccusage missing, unparseable, or a collection failure →
    same pattern for usage.json
  - collect git, attribute, and report failures remain fatal — there is
    nothing useful to report without commits, and a broken attribute/report
    step signals a real data problem
- --since <date> passes through to collect git

Do not add new collectors.
Do not add a database.
Do not add Claude hooks.
Do not add arbitrary scores or awards.
