
# Floor200 Development Guide

## Product

Floor200 is a local-first CLI for measuring AI coding-agent ROI.

It correlates agent usage/spend with GitHub merged PRs, contributors, repos, and work types to show where tokens become shipped work and where they are wasted.

## Core principle

Do not build a toy leaderboard. Build a useful engineering ROI report.

The product should answer:

* Where is AI coding spend going?
* What shipped from that spend?
* Which models, repos, contributors, and workflows produce useful output?
* Where is spend being wasted?
* What should the team change next?

## Non-negotiables

* Do not build a web dashboard.
* Do not collect raw prompts by default.
* Do not collect source-code contents by default.
* Do not store secrets.
* Keep storage local by default.
* Prefer metadata over content.
* Avoid arbitrary scores.
* Prefer transparent metrics.
* Every attribution must include a confidence level.
* External CLI calls must be wrapped and mockable.
* Unit tests should not make real network calls.

## Tech stack

* TypeScript
* Node.js
* pnpm
* commander
* SQLite later
* zod later
* vitest
* tsup

## Useful metrics

* total AI coding spend
* attributed merged PRs
* cost per merged PR
* abandoned spend
* waste rate
* spend by model
* spend by contributor
* spend by repo
* spend by work type
* CI pass rate
* revert count
* median review time
* attribution confidence
* recommendations

## Product tone

Professional, sharp, slightly fun.

Allowed:

* season
* leaderboard
* token burn

Avoid unnecessary game jargon like quests, boss fights, or random awards unless it directly helps explain a metric.

## Privacy rules

Never store by default:

* raw prompts
* source-code contents
* secrets
* full terminal output
* `.env` contents
* credential files

Store by default:

* agent/source name
* session ID
* timestamps
* model name when available
* token counts
* estimated cost
* repo path or repo hash
* branch name
* commit SHAs
* PR numbers
* PR metadata
* changed file paths
* CI status

## MVP order

1. Demo ROI report with fake data.
2. Local export to markdown/json.
3. GitHub merged PR collector.
4. Local git commit collector.
5. ccusage adapter.
6. Attribution engine.
7. Recommendations engine.
8. Claude Code hook installer.
9. Team export/merge workflow.

## Done criteria

A task is done only when:

* TypeScript compiles.
* Tests pass.
* CLI command works locally.
* Output is readable.
* No privacy rule is violated.
* New logic has tests where reasonable.
