# One-Command Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chain collect git → collect prs → collect usage → attribute →
report behind a single `floor200 run` command, auto-initializing config and
degrading gracefully per step.

**Architecture:** `src/pipeline.ts` contains a pure, testable orchestrator
(`runPipeline`) that calls the existing collector/attribution/report
functions and reports step outcomes via a callback. `src/cli.ts` exposes
`run` and prints step details/warnings and the final report.

**Tech Stack:** TypeScript, Node.js, Commander, Vitest, pnpm, tsup

## Global Constraints

- No new collection or attribution logic — reuse existing exported functions.
- Missing `.floor200.yml` auto-initializes with defaults and continues.
- Git, attribute, and report failures are fatal. PR and usage collection
  failures are degradable: warn, skip, continue.
- Never overwrite an existing data file with an empty one when skipping a
  step.

---

### Task 1: Pipeline orchestrator

**Files:** Create `src/pipeline.ts` and `tests/pipeline.test.ts`.

- [x] Write failing unit tests for the happy path (step order, attributions
      written, non-empty report), auto-init on missing config, a `gh`
      authentication failure (skip + warn + empty `prs.json`), a missing
      `ccusage` failure (skip + warn + empty `usage.json`), stale-data
      preservation on a skipped step, a fatal git failure, and `--since`
      passthrough.
- [x] Implement `runPipeline({ baseDirectory?, runner?, since?, onStep? })`
      with the degradation rules above.
- [x] Run the focused test and confirm all pipeline tests pass.

### Task 2: CLI integration

**Files:** Modify `src/cli.ts` and `tests/cli.test.ts`.

- [x] Write failing CLI tests for the auto-init happy path and the
      `gh`-unauthenticated degraded path, using fake `git`/`gh`/`ccusage`
      executables on `PATH`.
- [x] Register `floor200 run` with `--since`, wire `onStep` to print details
      and warnings, and map fatal error classes to existing messages.
- [x] Run focused CLI tests and confirm they pass.

### Task 3: Docs

- [x] Move the roadmap item to Done in `ROADMAP.md`.
- [x] Add `prompts/09-run-pipeline.md`.

### Task 4: Verification

- [x] Run `pnpm build` and `pnpm test`.
- [x] Run the built CLI against this repo's real data (`node dist/cli.js run`)
      and inspect output.
- [x] Run the built CLI in a fresh temp git repo with no config and no `gh`
      auth to confirm the degraded path exits 0 with warnings and a report.
