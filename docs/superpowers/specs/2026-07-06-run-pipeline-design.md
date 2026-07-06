# One-Command Pipeline Design

## Goal

Add `floor200 run` so a new user goes from a bare repo to a printed ROI
report in a single command, instead of five sequential commands
(`init` → `collect git` → `collect prs` → `collect usage` → `attribute` →
`report`).

## Principles

The pipeline is pure orchestration: it introduces no new collection or
attribution logic and calls the existing exported functions
(`collectGitCommits`, `collectPullRequests`, `collectUsage`, `runAttribution`,
`runRoiReport`) in sequence. A missing `.floor200.yml` is auto-created via the
existing `initializeProject` with default values, printed as a note, and the
run continues.

Some steps are safe to skip when they fail; others are not. Local git commits
are the spine of attribution, so a git failure is fatal — there's nothing
useful to report without commits. Pull request collection and usage
collection depend on external tools/auth (`gh`, `ccusage`) the user may not
have configured yet, so failures there are non-fatal: the step is skipped
with a printed warning, and the pipeline continues so the user still gets a
report from whatever data is available.

## Degradation rules

- **collect prs** — `gh` missing, `gh` unauthenticated, `project.repo`
  missing/invalid, or a GitHub API/parse failure → warn, skip, continue.
- **collect usage** — `ccusage` missing, unparseable, or a collection failure
  → warn, skip, continue.
- **collect git, attribute, report** — any failure is fatal. A broken
  `attribute`/`report` step signals a real data problem, not a missing
  optional tool.
- Skipping a step ensures its data file exists as `[]` **only if it doesn't
  already exist**, since `runAttribution` requires `commits.json`,
  `prs.json`, and `usage.json` all to be present. If the file already has
  data from a previous run, it is left untouched (the pipeline doesn't
  clobber good data because of a transient auth failure) and the message
  notes that previously collected data is being used instead.

## Components

`src/pipeline.ts` owns orchestration: `runPipeline({ baseDirectory?, runner?,
since?, onStep? })` returns `{ steps, report }`, where each `PipelineStepResult`
carries a status (`ok` | `skipped` | `initialized`), a human-readable detail
line, and an optional warning. It does no printing itself — the caller
(`onStep`) decides how to render progress, keeping the orchestrator testable
without spawning a CLI process.

`src/cli.ts` registers `run` with a `--since` passthrough to `collect git`,
prints each step's detail (and any warning to stderr), and maps the fatal
error classes to the same user-facing messages already used by the
individual commands (`InvalidSinceDateError`, `InvalidConfigError`,
`GitRepositoryError`, `GitLogParseError`, `GitCollectionError`,
`AttributionDataError`, `RoiReportDataError`).

## Testing

Unit tests (`tests/pipeline.test.ts`) inject a fake `CommandRunner` and cover:
the full happy path in step order, auto-init on missing config (with the
default `project.repo: null` causing a graceful PR skip), a `gh`
authentication failure, a missing-`ccusage` failure, stale-data preservation
on a skipped step, a fatal git failure, and `--since` passthrough.

CLI integration tests (`tests/cli.test.ts`) spawn the real CLI with fake
`git`/`gh`/`ccusage` executables on `PATH`, covering the full auto-init happy
path and the `gh`-unauthenticated degraded path end to end.

## Privacy and scope

The pipeline stores nothing new — it only orchestrates existing collectors
and their existing output files. No new prompts, source content, database,
or hooks.
